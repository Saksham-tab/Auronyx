import pandas as pd
from pymongo import MongoClient

def load_reviews_from_mongo(
    uri: str = "mongodb+srv://dubeysaksham23:Saksham15@auronyxdaata.gkmu9zf.mongodb.net/",
    db_name: str = "test",
    collection_name: str = "Review"
) -> pd.DataFrame:
    """
    Load reviews from a MongoDB collection and return a DataFrame
    with columns: location, review, rating
    """
    client = MongoClient(uri)
    db = client[db_name]
    collection = db[collection_name]

    reviews = []

    try:
        for data in collection.find():
            # Extract district (location)
            district = (
                data.get("location", {})
                .get("address", {})
                .get("district", "Unknown")
            )

            # Extract rating - use overallRating as primary, fallback to taste rating
            rating = data.get("reviewData", {}).get("overallRating", None)
            if not rating:
                rating = data.get("reviewData", {}).get("taste", None)

            # Extract review description from additionalComments
            description = data.get("reviewData", {}).get("additionalComments", "")
            
            # If no description, create one from other review data
            if not description:
                # Combine other review aspects into a description
                aspects = []
                for key, value in data.get("reviewData", {}).items():
                    if key not in ["overallRating", "taste", "additionalComments"] and isinstance(value, (int, float)):
                        aspects.append(f"{key}: {value}/5")
                description = " | ".join(aspects) if aspects else "No detailed review provided"

            if district and rating is not None and description:
                reviews.append(
                    {
                        "location": district,
                        "review": description,
                        "rating": float(rating),
                    }
                )
    except Exception as e:
        # Silently handle MongoDB errors to avoid contaminating JSON output
        pass

    return pd.DataFrame(reviews)


# Run standalone test
if __name__ == "__main__":
    uri = "mongodb+srv://dubeysaksham23:Saksham15@auronyxdaata.gkmu9zf.mongodb.net/"  # change if using Atlas or remote Mongo
    db_name = "test"               # your database name
    collection_name = "Review"         # your collection name

    df = load_reviews_from_mongo(uri, db_name, collection_name)
    print(df.head())
