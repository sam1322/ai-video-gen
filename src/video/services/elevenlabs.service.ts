import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenAI } from '@google/genai';
import * as wav from 'wav';

@Injectable()
export class ElevenLabsService {
  private ai: GoogleGenAI;
  constructor(private configService: ConfigService) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    this.ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }

  async generateAudioByElevenLabs(text: string, jobId: string): Promise<string> {
    try {
      const apiKey = this.configService.get<string>('ELEVENLABS_API_KEY');

      if (!apiKey) {
        // Fallback: create a dummy audio file
        return this.createDummyAudio(jobId);
      }

      const response = await axios.post(
        'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM',
        {
          text: text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        },
        {
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': apiKey,
          },
          responseType: 'arraybuffer',
        }
      );

      const audioPath = path.join(process.cwd(), 'uploads', `${jobId}_audio.mp3`);
      fs.writeFileSync(audioPath, response.data);
      return audioPath;

    } catch (error) {
      console.error('ElevenLabs API error:', error);
      return this.createDummyAudio(jobId);
    }
  }


  async saveWaveFile(
    filename: string,
    // pcmData: Buffer<ArrayBufferLike>,
    pcmData: Buffer,
    channels = 1,
    rate = 24000,
    sampleWidth = 2,
  ) {
    return new Promise((resolve, reject) => {
      const writer = new wav.FileWriter(filename, {
        channels,
        sampleRate: rate,
        bitDepth: sampleWidth * 8,
      });

      writer.on('finish', resolve);
      writer.on('error', reject);

      writer.write(pcmData);
      writer.end();
    });
  }

  async generateAudioByGoogle(text: string, jobId: string): Promise<string> {

    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Narrate this with an engaging and excited tone, like a top YouTube creator unveiling a new product: ${text}` }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Charon' },
          },
        },
      },
    });

    const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    // @ts-expect-error type error
    const audioBuffer = Buffer.from(data, 'base64');
    console.log("response,", response)
    // const fileName = 'out.wav';
    const audioPath = path.join(process.cwd(), 'uploads', `gemini_${jobId}_audio_${Date.now()}.wav`);
    await this.saveWaveFile(audioPath, audioBuffer);
    return audioPath;
  }


  async generateAudioByGoogl1e(text: string, jobId: string): Promise<string> {
    try {
      const apiKey = this.configService.get<string>('ELEVENLABS_API_KEY');

      if (!apiKey) {
        // Fallback: create a dummy audio file
        return this.createDummyAudio(jobId);
      }

      const response = await axios.post(
        'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM',
        {
          text: text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        },
        {
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': apiKey,
          },
          responseType: 'arraybuffer',
        }
      );

      const audioPath = path.join(process.cwd(), 'uploads', `${jobId}_audio.mp3`);
      fs.writeFileSync(audioPath, response.data);
      return audioPath;

    } catch (error) {
      console.error('ElevenLabs API error:', error);
      return this.createDummyAudio(jobId);
    }
  }

  private createDummyAudio(jobId: string): any {
    // Create a 10-second silent audio file using FFmpeg
    const audioPath = path.join(process.cwd(), 'uploads', `${jobId}_audio.mp3`);
    const ffmpeg = require('fluent-ffmpeg');

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input('anullsrc=channel_layout=stereo:sample_rate=48000')
        .inputFormat('lavfi')
        .duration(10)
        .audioCodec('libmp3lame')
        .save(audioPath)
        .on('end', () => resolve(audioPath))
        .on('error', reject);
    });
  }
}