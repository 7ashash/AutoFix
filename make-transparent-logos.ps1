Add-Type -AssemblyName System.Drawing

$code = @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public static class LogoTransparencyTool
{
    public static Bitmap ResizeBitmap(Image source, int maxSize)
    {
        int width = source.Width;
        int height = source.Height;
        double scale = Math.Min((double)maxSize / width, (double)maxSize / height);
        if (scale > 1.0) scale = 1.0;

        int newWidth = Math.Max(1, (int)Math.Round(width * scale));
        int newHeight = Math.Max(1, (int)Math.Round(height * scale));

        Bitmap resized = new Bitmap(newWidth, newHeight, PixelFormat.Format32bppArgb);
        using (Graphics g = Graphics.FromImage(resized))
        {
            g.Clear(Color.Transparent);
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.SmoothingMode = SmoothingMode.HighQuality;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.DrawImage(source, 0, 0, newWidth, newHeight);
        }

        return resized;
    }

    public static void MakeEdgeBackgroundTransparent(Bitmap bitmap, int tolerance)
    {
        int width = bitmap.Width;
        int height = bitmap.Height;
        bool[] visited = new bool[width * height];
        Queue<int> queue = new Queue<int>();

        Color bg = AverageCorners(bitmap);

        Action<int, int> enqueue = (x, y) =>
        {
            int index = (y * width) + x;
            if (visited[index]) return;

            Color pixel = bitmap.GetPixel(x, y);
            if (!IsSimilar(pixel, bg, tolerance)) return;

            visited[index] = true;
            queue.Enqueue(index);
        };

        for (int x = 0; x < width; x++)
        {
            enqueue(x, 0);
            enqueue(x, height - 1);
        }

        for (int y = 0; y < height; y++)
        {
            enqueue(0, y);
            enqueue(width - 1, y);
        }

        int[] dx = new[] { 1, -1, 0, 0 };
        int[] dy = new[] { 0, 0, 1, -1 };

        while (queue.Count > 0)
        {
            int index = queue.Dequeue();
            int x = index % width;
            int y = index / width;

            bitmap.SetPixel(x, y, Color.FromArgb(0, 255, 255, 255));

            for (int i = 0; i < 4; i++)
            {
                int nx = x + dx[i];
                int ny = y + dy[i];
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

                int nextIndex = (ny * width) + nx;
                if (visited[nextIndex]) continue;

                Color nextPixel = bitmap.GetPixel(nx, ny);
                if (!IsSimilar(nextPixel, bg, tolerance)) continue;

                visited[nextIndex] = true;
                queue.Enqueue(nextIndex);
            }
        }
    }

    private static Color AverageCorners(Bitmap bitmap)
    {
        Color c1 = bitmap.GetPixel(0, 0);
        Color c2 = bitmap.GetPixel(bitmap.Width - 1, 0);
        Color c3 = bitmap.GetPixel(0, bitmap.Height - 1);
        Color c4 = bitmap.GetPixel(bitmap.Width - 1, bitmap.Height - 1);

        int r = (c1.R + c2.R + c3.R + c4.R) / 4;
        int g = (c1.G + c2.G + c3.G + c4.G) / 4;
        int b = (c1.B + c2.B + c3.B + c4.B) / 4;

        return Color.FromArgb(255, r, g, b);
    }

    private static bool IsSimilar(Color pixel, Color bg, int tolerance)
    {
        if (pixel.A == 0) return true;

        return Math.Abs(pixel.R - bg.R) <= tolerance
            && Math.Abs(pixel.G - bg.G) <= tolerance
            && Math.Abs(pixel.B - bg.B) <= tolerance;
    }
}
"@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing

$outputDir = Join-Path $PSScriptRoot "pictures\\brand-logos"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$logos = @(
  @{ Source = "pictures\\bmw logo.jpeg"; Output = "bmw.png" },
  @{ Source = "pictures\\audi logo.jpeg"; Output = "audi.png" },
  @{ Source = "pictures\\mercedes logo.jpeg"; Output = "mercedes.png" },
  @{ Source = "pictures\\nissan logo.jpeg"; Output = "nissan.png" },
  @{ Source = "pictures\\hyaundai logo.jpeg"; Output = "hyundai.png" },
  @{ Source = "pictures\\toyota logo.jpeg"; Output = "toyota.png" },
  @{ Source = "pictures\\peugeot.jpeg"; Output = "peugeot.png" },
  @{ Source = "pictures\\mg logo2.jpeg"; Output = "mg.png" },
  @{ Source = "pictures\\kia logo.jpeg"; Output = "kia.png" },
  @{ Source = "pictures\\chevorlet logo.jpeg"; Output = "chevrolet.png" }
)

foreach ($logo in $logos) {
  $sourcePath = Join-Path $PSScriptRoot $logo.Source
  $outputPath = Join-Path $outputDir $logo.Output

  $sourceImage = [System.Drawing.Image]::FromFile($sourcePath)
  try {
    $resized = [LogoTransparencyTool]::ResizeBitmap($sourceImage, 320)
    try {
      [LogoTransparencyTool]::MakeEdgeBackgroundTransparent($resized, 52)
      $resized.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
      $resized.Dispose()
    }
  }
  finally {
    $sourceImage.Dispose()
  }
}
