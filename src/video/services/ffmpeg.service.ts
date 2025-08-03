import { Injectable } from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';

@Injectable()
export class FFmpegService {
  // Helper function to get audio duration
  private getAudioDuration(audioPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) return reject(err);
        resolve(metadata.format.duration);
      });
    });
  }
  async createVideo(imagePaths: string[], audioPath: string, jobId: string): Promise<string> {
    const outputPath = path.join(process.cwd(), 'uploads', `${jobId}_final.mp4`);

    // Get the real audio duration first!
    const audioDuration = await this.getAudioDuration(audioPath);
    const durationPerImage = audioDuration / imagePaths.length;

    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Add each image as a separate input with loop and duration
      imagePaths.forEach((imagePath, index) => {
        command.input(imagePath)
          .inputOptions([
            '-loop', '1',
            '-t', durationPerImage.toString(),
            '-r', '25' // Set frame rate
          ]);
      });

      // Add audio as the last input
      command.input(audioPath);

      // Build the filter chain
      const filterChain = this.buildFilterChain(imagePaths.length);

      command
        .complexFilter(filterChain)
        .outputOptions([
          '-map', '[outv]',
          '-map', `${imagePaths.length}:a`, // Audio is the last input
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-r', '25',
          '-pix_fmt', 'yuv420p',
          '-shortest',
          '-preset', 'fast'
        ])
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          console.log('FFmpeg progress:', progress);
        })
        .on('end', () => {
          console.log('Video creation completed');
          resolve(outputPath);
        })
        .on('error', (err, stdout, stderr) => {
          console.error('FFmpeg error:', err.message);
          console.error('FFmpeg stdout:', stdout);
          console.error('FFmpeg stderr:', stderr);
          reject(err);
        })
        .save(outputPath);
    });
  }

private buildFilterChain(imageCount: number): string[] {
  const outputWidth = 1080;
  const outputHeight = 1920;

  // This filter scales your 1024x1024 image to fit the 1080p width
  // and then adds black bars to the top and bottom to create a 9:16 video.
  const filter = `scale=${outputWidth}:-1,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2,setdar=9/16`;

  const filters: string[] = [];

  // Apply the filter to each input image
  for (let i = 0; i < imageCount; i++) {
    filters.push(`[${i}:v]${filter}[v${i}]`);
  }

  // Concatenate all the filtered videos
  const concatInputs = Array.from({ length: imageCount }, (_, i) => `[v${i}]`).join('');
  filters.push(`${concatInputs}concat=n=${imageCount}:v=1:a=0[outv]`);

  return filters;
}

  async createVideo1(imagePaths: string[], audioPath: string, jobId: string): Promise<string> {
    const outputPath = path.join(process.cwd(), 'uploads', `${jobId}_final.mp4`);

    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Add images with duration
      imagePaths.forEach((imagePath, index) => {
        command.input(imagePath).loop(3.33); // Each image shows for ~3.33 seconds
      });

      // Add audio
      command.input(audioPath);

      command
        .complexFilter([
          // Concatenate images
          `${imagePaths.map((_, i) => `[${i}:v]`).join('')}concat=n=${imagePaths.length}:v=1:a=0[v]`,
        ])
        .outputOptions([
          '-map', '[v]',
          '-map', `${imagePaths.length}:a`,
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-shortest',
          '-pix_fmt', 'yuv420p'
        ])
        .save(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject);
    });
  }
}