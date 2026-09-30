"""The per-pixel debris classifier.

Four classes (debris / foam / algae / water) over nine features. Multinomial
logistic regression on standardised features: small, fast, inspectable, and
honest about what a single image can do -- it is deliberately *not* good enough
on its own, which is the whole argument for tracking.

Production would swap this for a U-Net trained on MARIDA + MADOS; see the
README section on switching to real data.
"""
from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Optional

import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.core.config import settings
from app.detect.spectra import CLASSES, FEATURE_NAMES, SPECTRA, WAVELENGTHS, features, training_set

_LOCK = threading.Lock()
_MODEL: Optional["Detector"] = None


@dataclass
class Detector:
    pipeline: Pipeline
    accuracy: float
    confusion: list[list[int]]
    n_train: int
    n_test: int
    seed: int

    def proba(self, px: np.ndarray) -> np.ndarray:
        """P(class | pixel) for an (..., 6) band stack -> (..., 4)."""
        px = np.asarray(px, dtype=np.float64)
        flat = features(px).reshape(-1, len(FEATURE_NAMES))
        out = self.pipeline.predict_proba(flat)
        return out.reshape(px.shape[:-1] + (len(CLASSES),))

    def debris_proba(self, px: np.ndarray) -> np.ndarray:
        return self.proba(px)[..., 0]

    def report(self) -> dict:
        return {
            "classes": CLASSES,
            "features": FEATURE_NAMES,
            "accuracy": round(self.accuracy, 4),
            "confusion": self.confusion,
            "n_train": self.n_train,
            "n_test": self.n_test,
            "seed": self.seed,
            "algorithm": "multinomial logistic regression on standardised features",
            "simulated": True,
            "production_plan": (
                "U-Net segmentation trained on MARIDA + MADOS (published F1 ~ 0.89), "
                "fine-tuned on Indian coastal scenes."
            ),
            "spectral_library": {
                "bands": list(SPECTRA.keys()),
                "wavelengths_nm": WAVELENGTHS,
                "spectra": SPECTRA,
            },
        }


def train(seed: int = 7, n: int = 6000, train_frac: float = 0.8) -> Detector:
    X, y = training_set(n=n, seed=seed)
    n_train = int(n * train_frac)
    # C is deliberately small. An unregularised fit separates sun glint from
    # plastic almost perfectly on these synthetic spectra, which no real
    # single-image detector does -- published Sentinel-2 detectors are routinely
    # fooled by glint and foam. Keeping the decision boundary soft reproduces
    # that confusability, which is the whole reason DriftSight tracks a
    # detection across passes instead of trusting one image.
    pipe = Pipeline([
        ("scale", StandardScaler()),
        ("clf", LogisticRegression(C=0.05, max_iter=3000)),
    ])
    pipe.fit(X[:n_train], y[:n_train])
    pred = pipe.predict(X[n_train:])
    acc = float((pred == y[n_train:]).mean())
    cm = confusion_matrix(y[n_train:], pred, labels=range(len(CLASSES))).tolist()
    return Detector(pipeline=pipe, accuracy=acc, confusion=cm,
                    n_train=n_train, n_test=n - n_train, seed=seed)


def get_detector(force: bool = False) -> Detector:
    """Load the saved model, or train and persist one on first use."""
    global _MODEL
    with _LOCK:
        if _MODEL is not None and not force:
            return _MODEL
        path = settings.model_path
        if path.exists() and not force:
            try:
                _MODEL = joblib.load(path)
                return _MODEL
            except Exception:  # a stale artefact should never block startup
                pass
        _MODEL = train()
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(_MODEL, path)
        return _MODEL
