import cv2
import numpy as np
import math

def calculate_angle(x1, y1, x2, y2):
    return abs(math.degrees(math.atan2(y2 - y1, x2 - x1)))

# Load image
image = cv2.imread("Photos/PersonStock1.jpg")
<<<<<<< HEAD
=======
<<<<<<< HEAD:fretboardDetector.py
gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
=======
gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)d
>>>>>>> 5695f59ace06c85226224432dbc725afc3630d92:fretDetector.py
blurred = cv2.GaussianBlur(gray, (5, 5), 0)
edges = cv2.Canny(blurred, 50, 100)
>>>>>>> b42eb45b114659b09c95ea57e78ade2ff6cd6c3b

# Step 1: Crop to neck
neck = image[400:640, 300:1000]  # Manually adjusted bounds
gray = cv2.cvtColor(neck, cv2.COLOR_BGR2GRAY)
blurred = cv2.GaussianBlur(gray, (5, 5), 0)
edges = cv2.Canny(blurred, 40, 90)  # Adjusted thresholds

# Step 2: Hough transform
lines = cv2.HoughLinesP(
    edges,
    rho=1,
    theta=np.pi / 180,
    threshold=12,
    minLineLength=30,
    maxLineGap=6
)

# Step 3: Separate lines
fret_lines = []
string_lines = []

if lines is not None:
    for line in lines:
        x1, y1, x2, y2 = line[0]
        angle = calculate_angle(x1, y1, x2, y2)
        length = np.sqrt((x2 - x1)**2 + (y2 - y1)**2)

        if 87 <= angle <= 93 and length > 30:
            avg_x = (x1 + x2) // 2
            if all(abs(avg_x - fx) > 12 for fx in fret_lines):  # stricter dedup
                fret_lines.append(avg_x)
        elif angle <= 5 and length > 40:
            avg_y = (y1 + y2) // 2
            if all(abs(avg_y - sy) > 8 for sy in string_lines):
                string_lines.append(avg_y)

fret_lines.sort()
string_lines.sort()

# Step 4: Draw fret rectangles
output = neck.copy()
for i in range(1, len(fret_lines) - 1):
    left = (fret_lines[i - 1] + fret_lines[i]) // 2
    right = (fret_lines[i] + fret_lines[i + 1]) // 2
    top = string_lines[0] - 5 if string_lines else 10
    bottom = string_lines[-1] + 5 if string_lines else neck.shape[0] - 10

    cv2.rectangle(output, (left, top), (right, bottom), (255, 255, 0), 2)
    cv2.putText(output, f"Fret {i}", (left + 2, top - 8),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)

# Show result
cv2.imshow("Fret Regions", output)
cv2.waitKey(0)
cv2.destroyAllWindows()
