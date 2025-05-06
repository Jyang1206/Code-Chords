import cv2 as cv
print("Running...")

capture = cv.VideoCapture('Videos/AcousticStock1.mp4')

while True:
    isTrue, frame = capture.read()
    cv.imshow('Video', frame)

    if cv.waitKey(10) & 0xFF==ord('d'):
        break

capture.release()
cv.destroyAllWindows()