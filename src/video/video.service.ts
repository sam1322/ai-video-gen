import { BadRequestException, Injectable } from '@nestjs/common';
import { OpenAIService } from './services/openai.service';
import { ElevenLabsService } from './services/elevenlabs.service';
import { ImageService } from './services/image.service';
import { FFmpegService } from './services/ffmpeg.service';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

export interface VideoJob {
  id: string;
  status: 'processing' | 'completed' | 'error';
  progress: number;
  filePath?: string;
  error?: string;
}

@Injectable()
export class VideoService {
  private jobs: Map<string, VideoJob> = new Map();

  constructor(
    private openaiService: OpenAIService,
    private elevenLabsService: ElevenLabsService,
    private imageService: ImageService,
    private ffmpegService: FFmpegService,
  ) {
    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  }

  async generateVideo(query: string): Promise<{ jobId: string }> {
    const jobId = uuidv4();

    this.jobs.set(jobId, {
      id: jobId,
      status: 'processing',
      progress: 0,
    });

    // Process video generation asynchronously
    this.processVideoGeneration(jobId, query).catch((error) => {
      this.jobs.set(jobId, {
        id: jobId,
        status: 'error',
        progress: 0,
        error: error.message,
      });
    });

    return { jobId };
  }
  public async generateScript(query: string): Promise<{ narration: string; visual_prompt: string[] }> {
    try {

      // Step 1: Generate script (20% progress)
      const script = await this.openaiService.generateScriptByGoogle(query);
      // this.updateProgress(jobId, 20);

      return this.parseScript(script);
      // this.updateProgress(jobId, 20);
    } catch (err) {
      throw new BadRequestException(err.message)
    }
  }

  private async processVideoGeneration(jobId: string, query: string) {
    try {
      const { narration, visual_prompt } = await this.generateScript(query)

      // Step 2: Generate images IN PARALLEL
      const imageGenerationPromises = visual_prompt.map((scene, index) =>
        this.imageService.generateImageByGoogle(scene, jobId, index)
      );
      const imagePaths = await Promise.all(imageGenerationPromises);
      this.updateProgress(jobId, 50); // Update progress after all images are done

      // Step 3: Generate voiceover using the clean narration text
      const audioPath = await this.elevenLabsService.generateAudioByGoogle(narration, jobId);
      this.updateProgress(jobId, 70);

      // Step 4: Combine into video (100% progress)
      const videoPath = await this.ffmpegService.createVideo(imagePaths, audioPath, jobId);
      this.updateProgress(jobId, 100);

      this.jobs.set(jobId, {
        id: jobId,
        status: 'completed',
        progress: 100,
        filePath: videoPath,
      });

    } catch (error) {
      throw error;
    }
  }

  async collectImagesByJobId(jobId: string): Promise<{
    imagePaths: string[], audioPath: string
  }> {
    const uploadsDirectory = path.join(process.cwd(), 'uploads');

    try {
      // 1. Read all files from the directory
      const allFiles = fs.readdirSync(uploadsDirectory);

      // 2. Filter files to find those that include the jobId
      const matchingFiles = allFiles.filter(file => file.includes(jobId));
      const filePaths = matchingFiles.map(file =>
        path.join(uploadsDirectory, file)
      );
      let audioPath = ""
      const imagePaths = filePaths.filter(file => {
        if (file.split(".")[1] == "wav") {
          audioPath = file;
          return false;
        }
        return true;
      })

      // 3. Create the full path for each matching file


      // return filePaths;
      return { imagePaths, audioPath }
    } catch (error) {
      console.error(`Error reading directory ${uploadsDirectory}:`, error);
      return { imagePaths: [], audioPath: "" }; // Return an empty array on error
    }
  }

  async generateCombinedVideo() {
    const jobId = "b81cbb4a-a034-4360-871c-10ef5e1db462"
    // return await this.collectImagesByJobId(jobId)
    const { imagePaths, audioPath } = await this.collectImagesByJobId(jobId)
    const videoPath = await this.ffmpegService.createVideo(imagePaths, audioPath, jobId);
    return videoPath;
    // this.updateProgress(jobId, 100);

    // this.jobs.set(jobId, {
    //   id: jobId,
    //   status: 'completed',
    //   progress: 100,
    //   filePath: videoPath,
    // });
  }

  // A much better way to handle the script
  private parseScript(scriptJson: string): { narration: string; visual_prompt: string[] } {
    try {
      // The AI's output is now a JSON string
      const parsedData = JSON.parse(scriptJson);

      // Basic validation to ensure the structure is correct
      if (!parsedData.narration || !Array.isArray(parsedData.visual_prompt)) {
        throw new BadRequestException("Invalid script format from AI.");
      }

      return parsedData;
    } catch (error) {
      throw new BadRequestException("Failed to parse AI script JSON:", error);
      // // Fallback if the AI messes up the JSON
      // return {
      //   narration: "Welcome to our video about making the perfect cup of coffee.",
      //   visual_prompt: ["A cinematic shot of a coffee cup on a table."]
      // };
    }
  }

  private updateProgress(jobId: string, progress: number) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.progress = progress;
      this.jobs.set(jobId, job);
    }
  }

  async getStatus(jobId: string): Promise<VideoJob | null> {
    return this.jobs.get(jobId) || null;
  }

  async getVideoPath(jobId: string): Promise<string> {
    const job = this.jobs.get(jobId);
    if (!job || !job.filePath) {
      throw new Error('Video not found');
    }
    return job.filePath;
  }
}