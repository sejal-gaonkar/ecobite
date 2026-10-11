
# EcoBite 🌱

EcoBite is a food donation platform that connects food donors
with people and organizations that can collect surplus food.

## Technology Stack

- HTML, CSS and JavaScript
- Python and FastAPI
- PostgreSQL
- REST API

## Features

- Add surplus food donations
- View and search food listings
- Reserve available food
- Release reservations
- Mark reserved food as donated
- Delete food listings
- Store donation records in PostgreSQL

## Setup

### 1. Create a Python virtual environment

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
```

### 2. Configure PostgreSQL

Create the database and user using the credentials in `.env`.
Execute `database/init.sql` against the `ecobite` database.

### 3. Start the backend

```powershell
uvicorn app:app --app-dir backend --reload
```

### 4. Open the API documentation

Visit http://127.0.0.1:8000/docs

## Note

This project is for educational purposes. Food donors are responsible
for following applicable food-safety requirements.
