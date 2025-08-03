import { Module } from '@nestjs/common';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';
import { OpenAIService } from './services/openai.service';
import { ElevenLabsService } from './services/elevenlabs.service';
import { ImageService } from './services/image.service';
import { FFmpegService } from './services/ffmpeg.service';

@Module({
  controllers: [VideoController],
  providers: [VideoService,
    OpenAIService,
    ElevenLabsService,
    ImageService,
    FFmpegService,
  ]
})
export class VideoModule { }
