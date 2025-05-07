import cv2
import numpy as np
import math

def calculate_angle(x1, y1, x2, y2):
    return abs(math.degrees(math.atan2(y2 - y1, x2 - x1)))

# Load and crop
image = cv2.imread("Photos/PersonStock1.jpg")
gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
blurred = cv2.GaussianBlur(gray, (5, 5), 0)
edges = cv2.Canny(blurred, 50, 100)

# Hough Line Transform
lines = cv2.HoughLinesP(
    edges,
    rho=1,
    theta=np.pi / 180,
    threshold=10,
    minLineLength=10,
    maxLineGap=6
)

# Filter & deduplicate
filtered_x = []
output = image.copy()
if lines is not None:
    for line in lines:
        x1, y1, x2, y2 = line[0]
        angle = calculate_angle(x1, y1, x2, y2)
        if 85 <= angle <= 95:
            avg_x = (x1 + x2) // 2
            # Only draw if it's not near an existing x-position
            if all(abs(avg_x - prev_x) > 8 for prev_x in filtered_x):
                filtered_x.append(avg_x)
                cv2.line(output, (x1, y1), (x2, y2), (0, 0, 255), 2)

# Show results
cv2.imshow("Cropped Fretboard", image)
cv2.imshow("Fret Lines", output)
cv2.waitKey(0)
cv2.destroyAllWindows()