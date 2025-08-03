import { GoogleGenAI, Modality } from '@google/genai';
import { InferenceClient } from '@huggingface/inference';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ImageService {
  private hf: InferenceClient;
  private ai: GoogleGenAI;

  // constructor(private configService: ConfigService) { }

  constructor(private configService: ConfigService) {
    // Initialize the Hugging Face client with your API token
    // It will automatically look for the HUGGINGFACE_API_KEY environment variable
    this.hf = new InferenceClient(this.configService.get<string>('HUGGINGFACE_API_KEY'));
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    this.ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }

  async generateImageByHuggingFace(prompt: string, jobId: string, index: number): Promise<string> {
    try {

      console.log(`Generating image for prompt: "${prompt}"`);

      const imageBlob = await this.hf.textToImage({
        provider: "auto",
        model: "black-forest-labs/FLUX.1-Krea-dev",
        inputs: `${prompt}`,
        // inputs: `cinematic, professional photo, high quality, ${prompt}`,
        // inputs: "Astronaut riding a horse",
        parameters: {
          // Negative prompts help improve image quality by telling the model what to avoid
          negative_prompt: 'blurry, bad quality, ugly, tiling, poorly drawn, disfigured, deformed',
          num_inference_steps: 5,
        },
      });

      // @ts-expect-error string blob type error
      const buffer = Buffer.from(await imageBlob.arrayBuffer());
      const time = Date.now();
      // 4. Save the Buffer to a file
      const imagePath = path.join(process.cwd(), 'uploads', `${jobId}_image_${index}_${time}.png`);
      fs.writeFileSync(imagePath, buffer);

      console.log(`Successfully saved image to ${imagePath}`);
      return imagePath;

    } catch (error) {
      throw new BadRequestException('Hugging Face image generation error:', error);
    }
  }

  async generateImageByGoogle(prompt: string, jobId: string, index: number): Promise<string> {
    try {
      let imagePath = ""

      // Set responseModalities to include "Image" so the model can generate  an image
      const response = await this.ai.models.generateContent({
        model: "gemini-2.0-flash-preview-image-generation",
        contents: prompt,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });
      console.log("response", response)
      // @ts-expect-error type error
      for (const part of response.candidates[0].content.parts) {
        // Based on the part type, either show the text or save the image
        if (part.text) {
          console.log(part.text);
        }
        if (part.inlineData) {
          const imageData = part.inlineData.data;
          // @ts-expect-error string blob type error
          const buffer = Buffer.from(imageData, "base64");
          imagePath = path.join(process.cwd(), 'uploads', `gemini_${jobId}_image_${index}_${Date.now()}.png`);

          fs.writeFileSync(imagePath, buffer);
          console.log("Image saved as " + imagePath);
        }
      }
      console.log(`Generating image for prompt: "${prompt}"`);

      return imagePath;

    } catch (error) {
      throw new BadRequestException('Hugging Face image generation error:', error);
    }
  }



  private createPlaceholderImage(jobId: string, index: number): Promise<string> {
    const imagePath = path.join(process.cwd(), 'uploads', `${jobId}_image_${index}.png`);
    const colors = ['#1f77b4', '#ff7f0e', '#2ca02c']; // Using hex codes
    const ffmpeg = require('fluent-ffmpeg');
    const color = colors[index % colors.length];

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(`color=c=${color}:s=1024x1024`)
        .inputFormat('lavfi')
        .frames(1)
        .save(imagePath)
        .on('end', () => resolve(imagePath))
        .on('error', (err) => {
          console.error('FFmpeg placeholder generation error:', err);
          reject(err);
        });
    });
  }
}