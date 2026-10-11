
import os
from contextlib import contextmanager
from datetime import datetime, timezone

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

app = FastAPI(title="EcoBite API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:5501",
        "http://127.0.0.1:5501",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@contextmanager
def database_connection():
    conn = None
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST", "localhost"),
            port=os.getenv("DB_PORT", "5432"),
            dbname=os.getenv("DB_NAME", "ecobite"),
            user=os.getenv("DB_USER", "ecobite"),
            password=os.getenv("DB_PASSWORD", "change_this_local_password"),
            cursor_factory=RealDictCursor,
        )
        yield conn
        conn.commit()
    except Exception:
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()


class FoodCreate(BaseModel):
    food_name: str = Field(min_length=2, max_length=100)
    restaurant: str = Field(min_length=2, max_length=100)
    quantity: int = Field(gt=0, le=10000)
    location: str = Field(min_length=2, max_length=200)
    category: str = Field(min_length=2, max_length=50)
    deadline: datetime


def check_database():
    try:
        with database_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        return True
    except Exception:
        return False


@app.get("/")
def home():
    return {
        "message": "Welcome to EcoBite API",
        "docs": "/docs",
    }


@app.get("/api/health")
def health():
    if not check_database():
        raise HTTPException(
            status_code=503,
            detail="Database connection failed. Check PostgreSQL and .env.",
        )
    return {"status": "healthy", "database": "connected"}


@app.get("/api/foods")
def get_foods():
    try:
        with database_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, food_name, restaurant, quantity, location,
                           category, deadline, status, created_at
                    FROM food_listings
                    ORDER BY created_at DESC
                """)
                return cur.fetchall()
    except psycopg2.Error:
        raise HTTPException(
            status_code=503,
            detail="Could not read food listings. Check database setup.",
        )


@app.post("/api/foods", status_code=201)
def add_food(food: FoodCreate):
    deadline = food.deadline
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)

    if deadline <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=422,
            detail="Pickup deadline must be in the future.",
        )

    try:
        with database_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO food_listings
                        (food_name, restaurant, quantity, location,
                         category, deadline)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING *
                """, (
                    food.food_name.strip(),
                    food.restaurant.strip(),
                    food.quantity,
                    food.location.strip(),
                    food.category.strip(),
                    deadline,
                ))
                return cur.fetchone()
    except psycopg2.Error:
        raise HTTPException(
            status_code=503,
            detail="Could not save donation to the database.",
        )


@app.post("/api/foods/{food_id}/reserve")
def reserve_food(food_id: int):
    with database_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE food_listings
                SET status = 'Reserved'
                WHERE id = %s
                  AND status = 'Available'
                  AND deadline > NOW()
                RETURNING *
            """, (food_id,))
            food = cur.fetchone()

    if food is None:
        raise HTTPException(
            status_code=409,
            detail="Food is unavailable, expired, or already reserved.",
        )
    return food


@app.post("/api/foods/{food_id}/release")
def release_food(food_id: int):
    with database_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE food_listings
                SET status = 'Available'
                WHERE id = %s
                  AND status = 'Reserved'
                  AND deadline > NOW()
                RETURNING *
            """, (food_id,))
            food = cur.fetchone()

    if food is None:
        raise HTTPException(
            status_code=409,
            detail="This reservation cannot be released.",
        )
    return food


@app.post("/api/foods/{food_id}/donate")
def mark_donated(food_id: int):
    with database_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE food_listings
                SET status = 'Donated'
                WHERE id = %s
                  AND status = 'Reserved'
                RETURNING *
            """, (food_id,))
            food = cur.fetchone()

    if food is None:
        raise HTTPException(
            status_code=409,
            detail="Only reserved food can be marked as donated.",
        )
    return food


@app.delete("/api/foods/{food_id}", status_code=204)
def delete_food(food_id: int):
    with database_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                DELETE FROM food_listings
                WHERE id = %s
                RETURNING id
            """, (food_id,))
            deleted = cur.fetchone()

    if deleted is None:
        raise HTTPException(status_code=404, detail="Listing not found.")
    return None
