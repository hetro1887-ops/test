import numpy as np
import onnxruntime as ort
from pathlib import Path
import time
import json
import re
import random
import logging
from typing import Optional
from collections import Counter

logger = logging.getLogger(__name__)


class TransactionCategorizer:
    """Transaction categorization model using TF-IDF + MLP classifier exported to ONNX."""

    CATEGORIES = [
        "Food & Dining",
        "Shopping",
        "Transportation",
        "Entertainment",
        "Bills & Utilities",
        "Health & Fitness",
        "Travel",
        "Income",
        "Transfer",
        "Groceries",
        "Gas & Fuel",
        "Education",
        "Personal Care",
    ]

    KEYWORD_RULES = {
        "Food & Dining": [
            "restaurant", "cafe", "coffee", "pizza", "burger", "sushi",
            "doordash", "grubhub", "uber eats", "starbucks", "mcdonald",
            "chipotle", "subway", "panera", "taco bell", "wendy",
            "chick-fil-a", "dunkin",
        ],
        "Shopping": [
            "amazon", "walmart", "target", "best buy", "apple store",
            "nike", "nordstrom", "macy", "costco", "home depot", "ikea",
            "etsy", "ebay",
        ],
        "Transportation": [
            "uber", "lyft", "taxi", "parking", "toll", "transit", "metro",
            "bus", "train", "amtrak",
        ],
        "Entertainment": [
            "netflix", "spotify", "hulu", "disney", "hbo", "cinema",
            "movie", "theater", "concert", "gaming", "xbox", "playstation",
            "steam",
        ],
        "Bills & Utilities": [
            "electric", "water", "gas bill", "internet", "phone bill",
            "comcast", "verizon", "at&t", "t-mobile", "utility", "sewage",
            "trash", "insurance",
        ],
        "Health & Fitness": [
            "pharmacy", "cvs", "walgreens", "gym", "fitness", "doctor",
            "hospital", "dental", "medical", "health",
        ],
        "Travel": [
            "airline", "hotel", "airbnb", "booking", "expedia", "marriott",
            "hilton", "delta", "united", "american airlines", "southwest",
        ],
        "Income": [
            "payroll", "direct deposit", "salary", "wage",
            "interest earned", "dividend", "refund",
        ],
        "Transfer": [
            "transfer", "zelle", "venmo", "cash app", "paypal", "wire",
            "ach",
        ],
        "Groceries": [
            "whole foods", "trader joe", "kroger", "safeway", "publix",
            "aldi", "grocery", "market",
        ],
        "Gas & Fuel": [
            "shell", "chevron", "exxon", "bp", "gas station", "fuel",
            "speedway", "wawa",
        ],
        "Education": [
            "tuition", "university", "college", "school", "udemy",
            "coursera", "textbook",
        ],
        "Personal Care": [
            "salon", "barber", "spa", "beauty", "nail", "skincare",
            "sephora",
        ],
    }

    def __init__(self, model_path: Optional[str] = None):
        self.session: Optional[ort.InferenceSession] = None
        self.vocab: dict[str, int] = {}
        self.idf_weights: dict[str, float] = {}
        if model_path and Path(model_path).exists():
            self._load_model(model_path)

    def _load_model(self, model_path: str) -> None:
        """Load ONNX model, vocabulary, and IDF weights from disk."""
        model_dir = Path(model_path).parent
        model_name = Path(model_path).stem

        # Load ONNX session with optimizations
        sess_options = ort.SessionOptions()
        sess_options.graph_optimization_level = (
            ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        )
        sess_options.intra_op_num_threads = 2
        sess_options.inter_op_num_threads = 1
        self.session = ort.InferenceSession(
            model_path, sess_options, providers=["CPUExecutionProvider"]
        )

        # Load vocabulary
        vocab_path = model_dir / f"{model_name}_vocab.json"
        if vocab_path.exists():
            with open(vocab_path, "r") as f:
                self.vocab = json.load(f)
            logger.info(f"Loaded vocabulary with {len(self.vocab)} terms")

        # Load IDF weights
        idf_path = model_dir / f"{model_name}_idf.json"
        if idf_path.exists():
            with open(idf_path, "r") as f:
                self.idf_weights = json.load(f)
            logger.info(f"Loaded IDF weights with {len(self.idf_weights)} terms")

        logger.info(f"Model loaded from {model_path}")

    def _preprocess(self, text: str) -> str:
        """Normalize transaction description."""
        text = text.lower().strip()
        text = re.sub(r"[^a-z0-9\s]", " ", text)
        text = re.sub(r"\s+", " ", text)
        text = re.sub(r"\b\d{4,}\b", "", text)  # Remove long numbers (card numbers)
        text = re.sub(r"\b(xx+\d+)\b", "", text)  # Remove masked card numbers
        return text.strip()

    def _text_to_features(self, text: str) -> np.ndarray:
        """Convert text to TF-IDF feature vector."""
        text = self._preprocess(text)
        words = text.split()

        # Create TF-IDF vector
        vector = np.zeros(len(self.vocab), dtype=np.float32)
        word_counts: dict[str, int] = {}
        for word in words:
            if word in self.vocab:
                word_counts[word] = word_counts.get(word, 0) + 1

        for word, count in word_counts.items():
            idx = self.vocab[word]
            tf = count / max(len(words), 1)
            idf = self.idf_weights.get(word, 1.0)
            vector[idx] = tf * idf

        return vector

    def predict(
        self,
        description: str,
        amount: Optional[float] = None,
        merchant_name: Optional[str] = None,
    ) -> tuple[str, float, dict[str, float]]:
        """Predict category with confidence scores."""
        # Combine available text
        text = description
        if merchant_name:
            text = f"{merchant_name} {text}"

        # Try ONNX model first
        if self.session:
            features = self._text_to_features(text).reshape(1, -1)
            outputs = self.session.run(None, {"input": features})
            probabilities = outputs[1][0]  # softmax output
            predicted_idx = int(np.argmax(probabilities))
            confidence = float(probabilities[predicted_idx])
            all_scores = {
                cat: float(prob)
                for cat, prob in zip(self.CATEGORIES, probabilities)
            }

            # If confidence is too low, fall back to rules
            if confidence < 0.3:
                rule_cat, rule_conf = self._rule_based_predict(text, amount)
                if rule_conf > confidence:
                    return rule_cat, rule_conf, all_scores

            return self.CATEGORIES[predicted_idx], confidence, all_scores

        # Fallback to rule-based
        category, confidence = self._rule_based_predict(text, amount)
        all_scores = {
            cat: (
                confidence
                if cat == category
                else (1 - confidence) / (len(self.CATEGORIES) - 1)
            )
            for cat in self.CATEGORIES
        }
        return category, confidence, all_scores

    def _rule_based_predict(
        self, text: str, amount: Optional[float] = None
    ) -> tuple[str, float]:
        """Rule-based fallback categorization."""
        text_lower = text.lower()

        best_category = "Shopping"  # default
        best_score = 0.0

        for category, keywords in self.KEYWORD_RULES.items():
            for keyword in keywords:
                if keyword in text_lower:
                    score = len(keyword) / max(len(text_lower), 1) + 0.5
                    if score > best_score:
                        best_score = score
                        best_category = category

        # Amount-based heuristics
        if amount is not None:
            if amount < 0:  # negative = credit/income
                if best_score < 0.3:
                    best_category = "Income"
                    best_score = 0.4

        return best_category, min(best_score, 0.95)

    @classmethod
    def create_default_model(cls, output_path: str) -> None:
        """Create and save a default ONNX model with synthetic training data.

        Pipeline:
        1. Generate ~5000 synthetic transaction descriptions from keyword rules
        2. Build vocabulary from training data (top 2000 words)
        3. Compute IDF weights
        4. Train sklearn MLPClassifier(hidden_layer_sizes=(256, 128), max_iter=500)
        5. Export to ONNX using skl2onnx
        6. Save vocabulary and IDF weights alongside the model
        """
        logger.info("Creating default model...")
        output_dir = Path(output_path).parent
        output_dir.mkdir(parents=True, exist_ok=True)
        model_name = Path(output_path).stem

        # -----------------------------------------------------------------
        # 1. Generate synthetic training data
        # -----------------------------------------------------------------
        descriptions, labels = cls._generate_synthetic_data()
        logger.info(
            f"Generated {len(descriptions)} synthetic transactions across "
            f"{len(set(labels))} categories"
        )

        # -----------------------------------------------------------------
        # 2. Build vocabulary (top 2000 words by document frequency)
        # -----------------------------------------------------------------
        vocab, idf_weights = cls._build_vocab_and_idf(descriptions, max_vocab=2000)
        logger.info(f"Built vocabulary with {len(vocab)} terms")

        # -----------------------------------------------------------------
        # 3. Vectorise training data into TF-IDF features
        # -----------------------------------------------------------------
        X = cls._vectorize_batch(descriptions, vocab, idf_weights)
        y = np.array(labels, dtype=np.int64)
        logger.info(f"Feature matrix shape: {X.shape}")

        # -----------------------------------------------------------------
        # 4. Train MLP classifier
        # -----------------------------------------------------------------
        from sklearn.neural_network import MLPClassifier

        clf = MLPClassifier(
            hidden_layer_sizes=(256, 128),
            max_iter=500,
            activation="relu",
            solver="adam",
            random_state=42,
            early_stopping=True,
            validation_fraction=0.1,
            batch_size=64,
            learning_rate="adaptive",
            learning_rate_init=0.001,
            verbose=False,
        )
        clf.fit(X, y)
        train_acc = clf.score(X, y)
        logger.info(f"Training accuracy: {train_acc:.4f}")

        # -----------------------------------------------------------------
        # 5. Export to ONNX using skl2onnx
        # -----------------------------------------------------------------
        from skl2onnx import convert_sklearn
        from skl2onnx.common.data_types import FloatTensorType

        initial_type = [("input", FloatTensorType([None, X.shape[1]]))]
        onnx_model = convert_sklearn(
            clf,
            initial_types=initial_type,
            target_opset=15,
            options={id(clf): {"zipmap": False}},
        )

        # The default sklearn ONNX converter for MLP produces label + probabilities.
        # We only need probabilities (softmax output).  Rename the probability
        # output to make consumption simpler and ensure the graph is valid.
        with open(output_path, "wb") as f:
            f.write(onnx_model.SerializeToString())
        logger.info(f"ONNX model saved to {output_path}")

        # Verify the exported model loads and runs
        sess = ort.InferenceSession(
            output_path, providers=["CPUExecutionProvider"]
        )
        test_out = sess.run(None, {"input": X[:1]})
        logger.info(
            f"ONNX verification — output shapes: "
            f"{[o.shape for o in test_out]}"
        )

        # -----------------------------------------------------------------
        # 6. Save vocabulary and IDF weights
        # -----------------------------------------------------------------
        vocab_path = output_dir / f"{model_name}_vocab.json"
        with open(vocab_path, "w") as f:
            json.dump(vocab, f)
        logger.info(f"Vocabulary saved to {vocab_path}")

        idf_path = output_dir / f"{model_name}_idf.json"
        with open(idf_path, "w") as f:
            json.dump(idf_weights, f)
        logger.info(f"IDF weights saved to {idf_path}")

        logger.info("Default model creation complete!")

    # ------------------------------------------------------------------
    # Private helpers for model creation
    # ------------------------------------------------------------------

    @classmethod
    def _generate_synthetic_data(
        cls, samples_per_category: int = 400
    ) -> tuple[list[str], list[int]]:
        """Generate ~5000+ realistic synthetic transaction descriptions."""
        random.seed(42)

        # Realistic prefixes, suffixes, and location strings
        prefixes = [
            "POS PURCHASE", "DEBIT CARD", "ONLINE PURCHASE", "RECURRING PMT",
            "ACH DEBIT", "CHECKCARD", "SQ *", "TST*", "SP ", "PP*",
            "PURCHASE AUTHORIZED ON", "VISA PURCHASE", "MASTERCARD",
            "MOBILE PAYMENT", "CONTACTLESS", "TAP TO PAY", "IN-STORE",
            "PREAUTHORIZED", "AUTOPAY", "",
        ]
        suffixes = [
            "NEW YORK NY", "LOS ANGELES CA", "CHICAGO IL", "HOUSTON TX",
            "PHOENIX AZ", "SAN FRANCISCO CA", "SEATTLE WA", "BOSTON MA",
            "MIAMI FL", "DENVER CO", "AUSTIN TX", "PORTLAND OR",
            "NASHVILLE TN", "ATLANTA GA", "SAN DIEGO CA", "ONLINE",
            "MOBILE APP", "WWW.SITE.COM", "",
        ]
        store_numbers = [
            "#12345", "#00987", "#55012", "STORE 421", "LOC 88",
            "UNIT 7", "*1234567", "", "", "",
        ]

        # Extended keyword templates per category for variety
        category_templates: dict[str, list[str]] = {
            "Food & Dining": [
                "STARBUCKS COFFEE", "MCDONALD'S", "CHIPOTLE MEXICAN GRILL",
                "SUBWAY SANDWICHES", "PANERA BREAD", "TACO BELL",
                "WENDY'S", "CHICK-FIL-A", "DUNKIN DONUTS", "DOMINOS PIZZA",
                "PIZZA HUT", "KFC", "FIVE GUYS BURGERS", "SHAKE SHACK",
                "BUFFALO WILD WINGS", "OLIVE GARDEN", "RED LOBSTER",
                "APPLEBEES", "IHOP", "WAFFLE HOUSE", "DENNY'S",
                "PANDA EXPRESS", "WOK EXPRESS", "SUSHI PALACE",
                "THAI KITCHEN", "DOORDASH", "GRUBHUB", "UBER EATS",
                "POSTMATES", "SEAMLESS", "RESTAURANT", "CAFE",
                "COFFEE SHOP", "BISTRO", "PIZZERIA", "BURGER JOINT",
                "FOOD TRUCK", "BAKERY", "DELI", "BAR AND GRILL",
                "STEAKHOUSE", "NOODLE BAR",
            ],
            "Shopping": [
                "AMAZON.COM", "AMAZON MARKETPLACE", "AMZN MKTP US",
                "WALMART SUPERCENTER", "WALMART.COM", "TARGET",
                "TARGET.COM", "BEST BUY", "BESTBUY.COM", "APPLE STORE",
                "APPLE.COM/BILL", "NIKE.COM", "NIKE FACTORY STORE",
                "NORDSTROM", "NORDSTROM RACK", "MACY'S", "COSTCO WHOLESALE",
                "HOME DEPOT", "LOWES", "IKEA", "ETSY.COM", "EBAY",
                "WAYFAIR", "OVERSTOCK", "BED BATH BEYOND", "ROSS STORES",
                "TJ MAXX", "MARSHALLS", "OLD NAVY", "GAP", "H&M",
                "ZARA", "FOREVER 21", "URBAN OUTFITTERS", "CRATE BARREL",
                "POTTERY BARN", "WILLIAMS SONOMA", "REI",
            ],
            "Transportation": [
                "UBER TRIP", "UBER RIDE", "LYFT RIDE", "LYFT INC",
                "YELLOW CAB", "TAXI SERVICE", "CITY PARKING",
                "PARKING METER", "PARK MOBILE", "SPOT HERO",
                "EZ PASS TOLL", "TOLL PLAZA", "BRIDGE TOLL",
                "METRO TRANSIT", "MTA NEW YORK", "BART TRANSIT",
                "CTA CHICAGO", "WMATA", "BUS FARE", "TRAIN TICKET",
                "AMTRAK", "GREYHOUND", "MEGABUS", "LIME SCOOTER",
                "BIRD SCOOTER", "CITIBIKE", "RIDE SHARE",
            ],
            "Entertainment": [
                "NETFLIX.COM", "NETFLIX SUBSCRIPTION", "SPOTIFY PREMIUM",
                "SPOTIFY USA", "HULU SUBSCRIPTION", "HULU LLC",
                "DISNEY PLUS", "DISNEY+", "HBO MAX", "HBO NOW",
                "APPLE TV+", "AMAZON PRIME VIDEO", "PARAMOUNT+",
                "PEACOCK PREMIUM", "AMC THEATRES", "REGAL CINEMAS",
                "CINEMARK", "FANDANGO", "TICKETMASTER", "LIVE NATION",
                "CONCERT TICKETS", "STUBHUB", "XBOX LIVE",
                "PLAYSTATION STORE", "NINTENDO ESHOP", "STEAM GAMES",
                "EPIC GAMES", "TWITCH SUB", "YOUTUBE PREMIUM",
                "MOVIE RENTAL", "THEATER TICKETS",
            ],
            "Bills & Utilities": [
                "ELECTRIC COMPANY", "POWER BILL", "CON EDISON",
                "DUKE ENERGY", "PACIFIC GAS ELECTRIC", "WATER UTILITY",
                "WATER BILL", "GAS BILL PAYMENT", "INTERNET BILL",
                "COMCAST XFINITY", "SPECTRUM CABLE", "AT&T WIRELESS",
                "VERIZON WIRELESS", "T-MOBILE", "SPRINT", "PHONE BILL",
                "CELL PHONE PAYMENT", "UTILITY PAYMENT", "SEWAGE BILL",
                "TRASH COLLECTION", "WASTE MANAGEMENT",
                "STATE FARM INSURANCE", "GEICO", "ALLSTATE INSURANCE",
                "PROGRESSIVE INS", "RENT PAYMENT", "MORTGAGE PAYMENT",
                "HOA DUES",
            ],
            "Health & Fitness": [
                "CVS PHARMACY", "WALGREENS", "RITE AID", "PHARMACY",
                "PRESCRIPTION", "PLANET FITNESS", "LA FITNESS",
                "24 HOUR FITNESS", "ORANGETHEORY", "CROSSFIT",
                "GYM MEMBERSHIP", "YOGA STUDIO", "DOCTOR VISIT",
                "MEDICAL CENTER", "HOSPITAL PAYMENT", "DENTAL OFFICE",
                "DENTIST", "URGENT CARE", "QUEST DIAGNOSTICS",
                "LABCORP", "HEALTH CLINIC", "PHYSICAL THERAPY",
                "CHIROPRACTOR", "OPTOMETRIST", "EYE DOCTOR",
                "VITAMINS SUPPLEMENTS",
            ],
            "Travel": [
                "DELTA AIR LINES", "UNITED AIRLINES", "AMERICAN AIRLINES",
                "SOUTHWEST AIRLINES", "JETBLUE AIRWAYS", "SPIRIT AIRLINES",
                "FRONTIER AIRLINES", "ALASKA AIRLINES",
                "MARRIOTT HOTEL", "HILTON HOTELS", "HYATT",
                "HOLIDAY INN", "BEST WESTERN", "AIRBNB",
                "BOOKING.COM", "EXPEDIA.COM", "HOTELS.COM",
                "KAYAK", "PRICELINE", "TRIVAGO", "HERTZ CAR RENTAL",
                "ENTERPRISE RENT", "AVIS BUDGET", "NATIONAL CAR RENTAL",
                "TURO", "CRUISE LINE", "TRAVEL AGENCY",
            ],
            "Income": [
                "PAYROLL DEPOSIT", "DIRECT DEPOSIT", "SALARY PAYMENT",
                "WAGE DEPOSIT", "EMPLOYER PAYMENT", "COMPANY PAYROLL",
                "INTEREST EARNED", "INTEREST PAYMENT", "DIVIDEND PAYMENT",
                "STOCK DIVIDEND", "TAX REFUND", "IRS REFUND",
                "STATE TAX REFUND", "CASHBACK REWARD", "REBATE",
                "BONUS PAYMENT", "COMMISSION PAYMENT",
                "FREELANCE PAYMENT", "CONSULTING FEE",
            ],
            "Transfer": [
                "ONLINE TRANSFER", "BANK TRANSFER", "WIRE TRANSFER",
                "ACH TRANSFER", "ZELLE PAYMENT", "ZELLE TRANSFER",
                "VENMO PAYMENT", "VENMO CASHOUT", "CASH APP",
                "PAYPAL TRANSFER", "PAYPAL PAYMENT", "SQUARE CASH",
                "INTERNAL TRANSFER", "SAVINGS TRANSFER",
                "CHECKING TO SAVINGS", "ACCOUNT TRANSFER",
                "EXTERNAL TRANSFER", "FUNDS TRANSFER",
            ],
            "Groceries": [
                "WHOLE FOODS MARKET", "TRADER JOES", "KROGER",
                "SAFEWAY", "PUBLIX", "ALDI", "FOOD LION",
                "STOP AND SHOP", "GIANT FOOD", "WEGMANS",
                "HEB GROCERY", "SPROUTS FARMERS", "FRESH MARKET",
                "PIGGLY WIGGLY", "WINCO FOODS", "GROCERY OUTLET",
                "MARKET BASKET", "SAVE A LOT", "FOOD MART",
                "ORGANIC MARKET", "FARMERS MARKET",
            ],
            "Gas & Fuel": [
                "SHELL OIL", "SHELL SERVICE STATION", "CHEVRON",
                "EXXONMOBIL", "EXXON", "BP GAS STATION", "BP AMOCO",
                "MOBIL GAS", "SPEEDWAY", "WAWA", "SHEETZ",
                "QUICKTRIP", "RACETRAC", "CASEY'S GENERAL STORE",
                "CIRCLE K", "7-ELEVEN FUEL", "VALERO",
                "SUNOCO", "PHILLIPS 66", "MARATHON GAS",
                "GAS STATION", "FUEL PURCHASE", "DIESEL FUEL",
                "EV CHARGING", "CHARGEPOINT", "TESLA SUPERCHARGER",
            ],
            "Education": [
                "UNIVERSITY TUITION", "COLLEGE TUITION",
                "SCHOOL PAYMENT", "STUDENT FEES", "UDEMY.COM",
                "COURSERA", "LINKEDIN LEARNING", "SKILLSHARE",
                "MASTERCLASS", "TEXTBOOK PURCHASE", "CHEGG",
                "PEARSON EDUCATION", "MCGRAW HILL", "KINDLE BOOKS",
                "EDUCATION PAYMENT", "TUTORING SERVICE",
                "SAT PREP", "ACT PREP", "KAPLAN TEST PREP",
                "SCHOOL SUPPLIES", "CAMPUS BOOKSTORE",
            ],
            "Personal Care": [
                "HAIR SALON", "GREAT CLIPS", "SUPERCUTS",
                "BARBER SHOP", "DAY SPA", "MASSAGE ENVY",
                "NAIL SALON", "MANICURE PEDICURE", "SEPHORA",
                "ULTA BEAUTY", "BATH BODY WORKS", "SKINCARE",
                "DERMATOLOGY", "WAXING CENTER", "BEAUTY SUPPLY",
                "COSMETICS", "FRAGRANCE", "LUSH COSMETICS",
                "AVEDA SALON", "PAUL MITCHELL",
            ],
        }

        descriptions: list[str] = []
        labels: list[int] = []

        for cat_idx, category in enumerate(cls.CATEGORIES):
            templates = category_templates.get(category, [])
            if not templates:
                continue

            for _ in range(samples_per_category):
                template = random.choice(templates)
                prefix = random.choice(prefixes)
                suffix = random.choice(suffixes)
                store_num = random.choice(store_numbers)

                # Randomly assemble the description
                parts = []
                if prefix and random.random() > 0.3:
                    parts.append(prefix)
                parts.append(template)
                if store_num and random.random() > 0.4:
                    parts.append(store_num)
                if suffix and random.random() > 0.3:
                    parts.append(suffix)

                desc = " ".join(parts)

                # Occasionally add noise (amounts, dates, reference numbers)
                if random.random() > 0.6:
                    desc += f" ${random.uniform(1, 500):.2f}"
                if random.random() > 0.7:
                    month = random.randint(1, 12)
                    day = random.randint(1, 28)
                    desc += f" {month:02d}/{day:02d}"
                if random.random() > 0.8:
                    ref = random.randint(100000, 999999)
                    desc += f" REF{ref}"

                descriptions.append(desc)
                labels.append(cat_idx)

        return descriptions, labels

    @classmethod
    def _build_vocab_and_idf(
        cls, descriptions: list[str], max_vocab: int = 2000
    ) -> tuple[dict[str, int], dict[str, float]]:
        """Build vocabulary and IDF weights from descriptions."""
        # Preprocess all descriptions
        preprocessor = cls._preprocess_static
        processed = [preprocessor(d) for d in descriptions]

        # Count document frequency for each word
        doc_freq: Counter[str] = Counter()
        for doc in processed:
            unique_words = set(doc.split())
            for word in unique_words:
                doc_freq[word] += 1

        # Select top words by document frequency (filtering rare and ultra-common)
        n_docs = len(processed)
        min_df = 2  # Must appear in at least 2 documents
        max_df_ratio = 0.95  # Must not appear in more than 95% of documents

        filtered_words = [
            (word, freq)
            for word, freq in doc_freq.items()
            if freq >= min_df and freq / n_docs <= max_df_ratio and len(word) > 1
        ]
        # Sort by frequency descending, take top max_vocab
        filtered_words.sort(key=lambda x: x[1], reverse=True)
        selected = filtered_words[:max_vocab]

        vocab = {word: idx for idx, (word, _) in enumerate(selected)}

        # Compute IDF: log(N / (1 + df))
        import math

        idf_weights = {
            word: math.log(n_docs / (1 + doc_freq[word]))
            for word in vocab
        }

        return vocab, idf_weights

    @staticmethod
    def _preprocess_static(text: str) -> str:
        """Static version of _preprocess for use in classmethods."""
        text = text.lower().strip()
        text = re.sub(r"[^a-z0-9\s]", " ", text)
        text = re.sub(r"\s+", " ", text)
        text = re.sub(r"\b\d{4,}\b", "", text)
        text = re.sub(r"\b(xx+\d+)\b", "", text)
        return text.strip()

    @classmethod
    def _vectorize_batch(
        cls,
        descriptions: list[str],
        vocab: dict[str, int],
        idf_weights: dict[str, float],
    ) -> np.ndarray:
        """Vectorise a batch of descriptions into TF-IDF feature matrix."""
        n_features = len(vocab)
        X = np.zeros((len(descriptions), n_features), dtype=np.float32)

        for i, desc in enumerate(descriptions):
            text = cls._preprocess_static(desc)
            words = text.split()
            word_counts: dict[str, int] = {}
            for word in words:
                if word in vocab:
                    word_counts[word] = word_counts.get(word, 0) + 1

            for word, count in word_counts.items():
                idx = vocab[word]
                tf = count / max(len(words), 1)
                idf = idf_weights.get(word, 1.0)
                X[i, idx] = tf * idf

        return X
