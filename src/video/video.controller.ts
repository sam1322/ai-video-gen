import { Controller, Post, Body, Get, Param, Res } from '@nestjs/common';
import { VideoService } from './video.service';
import { Response } from 'express';
import { OpenAIService } from './services/openai.service';
import { ImageService } from './services/image.service';
import { ElevenLabsService } from './services/elevenlabs.service';

@Controller('video')
export class VideoController {
  constructor(private readonly videoService: VideoService,

    private readonly openaiService: OpenAIService,
    private readonly imageService: ImageService,
    private readonly audioService: ElevenLabsService,
  ) { }

  @Post('generate')
  async generateVideo(@Body() body: { query: string }) {
    return await this.videoService.generateVideo(body.query);
  }
  @Post('generate/script')
  async generateScript(@Body() body: { query: string }) {
    const script = await this.videoService.generateScript(body.query);
    return { script: script }
  }

  @Post('generate/image')
  async generateImage(@Body() body: { query: string }) {
    const image = await this.imageService.generateImageByGoogle(body.query, "123", 1);
    return { image: image }
  }

  @Post('generate/audio')
  async generateAudio(@Body() body: { query: string }) {
    const audio = await this.audioService.generateAudioByGoogle(body.query, "123");
    return { audio: audio }
  }

  @Post('generate/video')
  async generateVideo2(@Body() body: { query: string }) {
    const video = await this.videoService.generateCombinedVideo();
    return { video: video }
  }


  @Get('status/:jobId')
  async getStatus(@Param('jobId') jobId: string) {
    return await this.videoService.getStatus(jobId);
  }

  @Get('download/:jobId')
  async downloadVideo(@Param('jobId') jobId: string, @Res() res: Response) {
    const filePath = await this.videoService.getVideoPath(jobId);
    res.download(filePath);
  }

}