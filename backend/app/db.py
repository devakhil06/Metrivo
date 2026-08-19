import os

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.uri_parser import parse_uri

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

_client = None
_db_name = None


def get_db():
    global _client, _db_name
    if _client is None:
        uri = os.environ.get("MONGODB_URI")
        if not uri:
            raise RuntimeError("MONGODB_URI is not set")
        _client = MongoClient(uri)
        _db_name = parse_uri(uri).get("database") or "test"
    return _client[_db_name]


def get_analytics_collection():
    return get_db()["kpis"]


def get_business(business_id):
    from bson import ObjectId

    return get_db()["businesses"].find_one({"_id": ObjectId(business_id)})
