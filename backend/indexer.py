import json
import os
import uuid
from typing import List, Dict, Any
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from embedding import get_embedding_model
from config import QDRANT_HOST, COLLECTION_NAME, VECTOR_DIM

def load_factory_data() -> Dict[str, Any]:
    json_path = os.path.join(os.path.dirname(__file__), "factory_data.json")
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"factory_data.json not found at {json_path}")
    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)

def build_documents(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    docs = []
    stage_managers = data.get("stageManagers", {})

    # 1. Orders
    for order in data.get("orders", []):
        order_id = order["id"]
        buyer_id = order["buyerId"]
        buyer_name = order["buyer"]
        product = order["product"]
        qty = order["quantity"]
        status = order["status"]
        priority = order["priority"]
        current_stage = order["currentStage"]
        progress = order["progress"]
        delivery = order["deliveryDate"]
        stages = order.get("stages", [])

        stage_summary = "; ".join([
            f"{st['label']}: {st['state']} ({st['completed']}/{st['target']} pcs, rejected: {st['rejected']})"
            for st in stages
        ])

        text = (
            f"Order ID: {order_id} | PO: {order['poNo']} | Style: {order['styleNo']}\n"
            f"Buyer: {buyer_name} (ID: {buyer_id})\n"
            f"Product: {product} ({order['category']}) | Fabric: {order['fabric']} | Color: {order['color']}\n"
            f"Quantity: {qty:,} pcs | Priority: {priority} | Status: {status} | Overall Progress: {progress}%\n"
            f"Current Active Stage: {current_stage.upper()} | Delivery Date: {delivery}\n"
            f"Stage Details: {stage_summary}"
        )

        docs.append({
            "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"order-{order_id}")),
            "text": text,
            "payload": {
                "doc_type": "order",
                "order_id": order_id,
                "buyer_id": buyer_id,
                "buyer_name": buyer_name,
                "status": status,
                "priority": priority,
                "current_stage": current_stage,
                "delivery_date": delivery,
                "allowed_roles": ["admin", "buyer", "process"],
                "title": f"Order {order_id} - {product} ({buyer_name})",
            }
        })

    # 2. Stage Summaries & Operational Load
    stage_summaries = data.get("stageSummaries", [])
    for stg in stage_summaries:
        key = stg["key"]
        label = stg.get("label", key.capitalize())
        manager = stage_managers.get(key, "Stage Manager")
        active_orders = stg.get("orders", 0)
        progress = stg.get("progress", 0)
        completed_qty = stg.get("completedQty", 0)
        pending_qty = stg.get("pendingQty", 0)
        load = stg.get("load", "Normal")

        text = (
            f"Manufacturing Stage: {label} (Key: {key})\n"
            f"Stage Manager / Incharge: {manager}\n"
            f"Active Orders in Stage: {active_orders} orders\n"
            f"Current Stage Progress: {progress}%\n"
            f"Operational Load: {load}\n"
            f"Total Completed: {completed_qty:,} units\n"
            f"Total Pending in Queue: {pending_qty:,} units"
        )

        docs.append({
            "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"stage-{key}")),
            "text": text,
            "payload": {
                "doc_type": "stage_metric",
                "stage_key": key,
                "manager": manager,
                "allowed_roles": ["admin", "process"],
                "title": f"Stage {label} Status & Operations",
            }
        })

    # 3. Raw Materials & Inventory
    materials = data.get("materials", [])
    for mat in materials:
        name = mat["name"]
        cat = mat["category"]
        stock = mat["stock"]
        reserved = mat["reserved"]
        min_req = mat["min"]
        unit = mat["unit"]
        avail = stock - reserved
        is_shortage = stock < min_req

        text = (
            f"Inventory Material: {name}\n"
            f"Category: {cat} | Current Stock: {stock:,} {unit} | Reserved for Production: {reserved:,} {unit}\n"
            f"Available Unallocated: {avail:,} {unit} | Minimum Safety Threshold: {min_req:,} {unit}\n"
            f"Status: {'CRITICAL DEFICIT / REORDER NEEDED' if is_shortage else 'Healthy Stock'}"
        )

        docs.append({
            "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"material-{name}")),
            "text": text,
            "payload": {
                "doc_type": "material",
                "material_name": name,
                "category": cat,
                "stock": stock,
                "is_shortage": is_shortage,
                "allowed_roles": ["admin"],
                "title": f"Material: {name} ({cat})",
            }
        })

    # 4. Bottlenecks & Operational Constraints
    bottlenecks = data.get("bottlenecks", [])
    for b in bottlenecks:
        stage = b["stage"]
        risk = b.get("risk", "HIGH")
        pending = b.get("pending", 0)
        capacity = b.get("capacity", 0)
        required = b.get("required", 0)
        gap = required - capacity

        text = (
            f"Factory Bottleneck Alert: Stage {stage.upper()}\n"
            f"Risk Level: {risk} | Pending Workload: {pending:,} pcs\n"
            f"Current Daily Capacity: {capacity:,} pcs/day | Required Run Rate: {required:,} pcs/day\n"
            f"Capacity Deficit: {gap:,} pcs/day gap\n"
            f"Impact: Production line backlog risk. Recommendation: Reallocate operators or add overtime line."
        )

        docs.append({
            "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"bottleneck-{stage}")),
            "text": text,
            "payload": {
                "doc_type": "bottleneck",
                "stage_key": stage.lower(),
                "severity": risk,
                "allowed_roles": ["admin", "process"],
                "title": f"Bottleneck Alert: {stage} ({risk})",
            }
        })

    # 5. AI Insights & Recommendations
    insights = data.get("insights", [])
    for ins in insights:
        kind = ins["kind"]
        title = ins["title"]
        body = ins["body"]
        action = ins["action"]
        risk = ins["risk"]
        impact = ins["impact"]

        text = (
            f"AI Factory Insight: {title}\n"
            f"Category: {kind} | Risk Level: {risk}\n"
            f"Observations: {body}\n"
            f"Operational Impact: {impact}\n"
            f"Recommended Immediate Action: {action}"
        )

        docs.append({
            "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"insight-{ins['id']}")),
            "text": text,
            "payload": {
                "doc_type": "insight",
                "risk_level": risk,
                "allowed_roles": ["admin"],
                "title": f"AI Insight: {title}",
            }
        })

    # 6. Buyers Directory
    buyers = data.get("buyers", [])
    for buyer in buyers:
        b_id = buyer["id"]
        b_name = buyer["name"]
        comp = buyer["company"]
        country = buyer["country"]

        text = (
            f"Buyer Record: {b_name} ({comp}) | Buyer ID: {b_id} | Country: {country}\n"
            f"Active Orders: {buyer['active']} | Completed: {buyer['completed']} | Delayed: {buyer['delayed']}\n"
            f"Total Lifetime Orders: {buyer['total']} | Last Order Date: {buyer['lastOrder']}"
        )

        docs.append({
            "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"buyer-{b_id}")),
            "text": text,
            "payload": {
                "doc_type": "buyer_profile",
                "buyer_id": b_id,
                "buyer_name": b_name,
                "company": comp,
                "allowed_roles": ["admin", "buyer"],
                "title": f"Buyer Profile: {b_name} ({comp})",
            }
        })

    return docs

def index_factory_kb():
    print(f"Connecting to Qdrant at {QDRANT_HOST}...")
    client = QdrantClient(url=QDRANT_HOST)

    print("Loading data...")
    data = load_factory_data()
    docs = build_documents(data)
    print(f"Constructed {len(docs)} documents.")

    print("Recreating Qdrant collection:", COLLECTION_NAME)
    client.recreate_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=VECTOR_DIM, distance=Distance.COSINE),
    )

    print("Initializing embedding model...")
    embed_model = get_embedding_model()

    texts = [d["text"] for d in docs]
    print(f"Generating embeddings for {len(texts)} documents...")
    embeddings = list(embed_model.embed(texts))

    points = [
        PointStruct(
            id=docs[i]["id"],
            vector=embeddings[i].tolist(),
            payload={
                **docs[i]["payload"],
                "text": docs[i]["text"],
            }
        )
        for i in range(len(docs))
    ]

    print(f"Upserting {len(points)} points into Qdrant...")
    client.upsert(
        collection_name=COLLECTION_NAME,
        points=points,
    )
    print("Indexing completed successfully!")
    return len(points)

if __name__ == "__main__":
    count = index_factory_kb()
    print(f"Done! {count} points indexed into {COLLECTION_NAME}.")
