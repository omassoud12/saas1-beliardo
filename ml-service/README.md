# Business ML environment

Isolated preparation for a future revenue forecasting and business anomaly
service. The React/Vite frontend, Node.js/Express backend, and Supabase remain
unchanged. No training code, FastAPI endpoints, database connections, model
implementations, or application integration have been created.

## Windows PowerShell setup

Use 64-bit CPython **3.12**. Python 3.11 is also compatible with the selected
direct dependency pins; 3.12 is the preferred baseline for this new environment.
The numerical stack provides compatible releases for this baseline; see
[NumPy](https://pypi.org/project/numpy/2.2.6/),
[scikit-learn](https://pypi.org/project/scikit-learn/1.7.2/), and
[XGBoost](https://pypi.org/project/xgboost/3.0.5/).
These are explicit baseline versions, not a claim to be the latest releases.
Transitive dependencies are resolved by pip rather than fully locked.

Install Python 3.12 with its Python launcher if needed, then from the repository
root run:

```powershell
cd ml-service
py -3.12 --version
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m pip check
python -c "import pandas, numpy, sklearn, xgboost, joblib, matplotlib, fastapi, uvicorn, pydantic, dotenv, pytest; print('All dependency imports succeeded')"
```

If the launcher is unavailable, use the full path to an installed Python 3.12
executable with PowerShell's `&` operator to create the environment. If activation
is blocked by PowerShell policy, activation is optional: run the install and
verification commands with `.\.venv\Scripts\python.exe` instead of `python`.
No execution-policy change is required.

When finished with an activated environment:

```powershell
deactivate
```

## Directory purposes

| Directory | Intended purpose |
| --- | --- |
| `app/` | Future service package; currently only an empty package marker. |
| `training/` | Future offline training package; currently only an empty package marker. |
| `data/raw/` | Local raw data, excluded from Git. |
| `data/processed/` | Local prepared data, excluded from Git. |
| `models/` | Local trained artifacts, excluded from Git. |
| `notebooks/` | Future exploratory notebooks; currently empty. |
| `tests/` | Future tests; currently empty. |

Empty directories have `.gitkeep` placeholders. `.env.example` contains unused
configuration placeholders only; no real `.env` or secrets have been created.
Never commit raw tenant data, processed tenant data, or trained model files.
Keep tenant data and model artifacts out of notebook contents and outputs too.

## Verification status and future work

Verified locally on Windows with 64-bit CPython **3.12.10**, installed for the
current user at `%LOCALAPPDATA%\Programs\Python\Python312\python.exe` using
the official, signature-verified Python Software Foundation installer.
The Python launcher detects this installation. Open a new PowerShell window
if your existing terminal has not picked up the updated PATH.

Created `.venv` and installed all 11 pinned dependencies and their transitive
dependencies. `python -m pip check` passed, and imports passed for all requested
packages, SciPy, and Uvicorn's Windows standard extras. No dependency conflicts
were found. The virtual environment and local installer are excluded from Git.

In a restricted execution environment, Matplotlib may lack permission to create
its user cache. Before running import checks there, use a writable local cache:

```powershell
$env:MPLCONFIGDIR = Join-Path (Get-Location) '.venv\matplotlib-cache'
```

This is a session-only setting and keeps the cache inside the ignored `.venv`.

Next step, before later implementation: define the tenant-scoped data contract, forecast
target, and evaluation criteria while preserving the existing business day of
6:00 AM to the following 6:00 AM in the business timezone. No such business
logic or data access is implemented here. A future VPS environment must be
verified separately; no deployment configuration has been added.
