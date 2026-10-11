
CREATE TABLE IF NOT EXISTS food_listings (
    id SERIAL PRIMARY KEY,
    food_name VARCHAR(100) NOT NULL,
    restaurant VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    location VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    deadline TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Available'
        CHECK (status IN ('Available', 'Reserved', 'Donated')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_food_listings_status
ON food_listings(status);

CREATE INDEX IF NOT EXISTS idx_food_listings_deadline
ON food_listings(deadline);
