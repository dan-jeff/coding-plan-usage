import os
from PIL import Image, ImageDraw, ImageFont


def create_icon(path):
    size = 512
    # Create a clean modern background (Deep Blue to Purple gradient-ish or just solid for simplicity)
    # Let's do a deep indigo solid circle
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Draw background circle
    margin = 20
    draw.ellipse(
        (margin, margin, size - margin, size - margin), fill="#4F46E5"
    )  # Indigo-600

    # Draw a "Usage" chart icon in the center
    # 3 bars
    center_x = size // 2
    center_y = size // 2

    # Bar width and spacing
    bar_width = 60
    spacing = 40

    # Bar 1 (Left, small)
    h1 = 150
    x1 = center_x - bar_width - spacing - (bar_width // 2)
    y1 = center_y + 100
    draw.rounded_rectangle((x1, y1 - h1, x1 + bar_width, y1), radius=10, fill="white")

    # Bar 2 (Middle, Tall)
    h2 = 250
    x2 = center_x - (bar_width // 2)
    y2 = center_y + 100
    draw.rounded_rectangle((x2, y2 - h2, x2 + bar_width, y2), radius=10, fill="white")

    # Bar 3 (Right, Medium)
    h3 = 180
    x3 = center_x + spacing + (bar_width // 2)
    y3 = center_y + 100
    draw.rounded_rectangle((x3, y3 - h3, x3 + bar_width, y3), radius=10, fill="white")

    # Save
    img.save(path)
    print(f"Icon created at {path}")


if __name__ == "__main__":
    assets_dir = os.path.join(os.getcwd(), "electron", "assets")
    if not os.path.exists(assets_dir):
        os.makedirs(assets_dir)

    create_icon(os.path.join(assets_dir, "icon.png"))
