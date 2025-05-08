from inference_sdk import InferenceHTTPClient
import json
import requests
from PIL import Image
from io import BytesIO
import base64
import re

client = InferenceHTTPClient(
    api_url="https://detect.roboflow.com",
    api_key="tNGaAGE5IufNanaTpyG3"
)

result = client.run_workflow(
    workspace_name="guitar-detection-thbw0",
    workflow_id="small-object-detection-sahi",
    images={
        "image": "Photos/AcousticStock1.jpg"
    },
    use_cache=True
)

print(json.dumps(result, indent=4)) # Print complete result JSON

# ---- Show the output image ----
output_image = None
if isinstance(result, list) and len(result) > 0 and isinstance(result[0], dict):
    output_image = result[0].get("output_image")

if output_image:
    # If output_image is a base64 string
    if isinstance(output_image, str) and output_image.startswith("data:image"):
        base64_data = re.sub('^data:image/.+;base64,', '', output_image)
        image_bytes = base64.b64decode(base64_data)
        image = Image.open(BytesIO(image_bytes))
        image.show()
    # If output_image is a URL
    elif isinstance(output_image, str) and output_image.startswith("http"):
        response = requests.get(output_image)
        image = Image.open(BytesIO(response.content))
        image.show()
    else:
        print("Unknown output_image format:", type(output_image))
else:
    print("No output_image key found in result")
