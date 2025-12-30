import base64
from io import BytesIO
from PIL import Image, ImageDraw


def get_b64(color):
    # Size 22x22 is standard for many Linux trays
    img = Image.new("RGBA", (22, 22), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Draw circle with border
    # Box is (left, top, right, bottom)
    draw.ellipse((2, 2, 19, 19), fill=color, outline=(255, 255, 255, 255), width=2)
    buf = BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")


print("GREEN=" + get_b64("#28a745"))
print("YELLOW=" + get_b64("#ffc107"))
print("RED=" + get_b64("#dc3545"))
