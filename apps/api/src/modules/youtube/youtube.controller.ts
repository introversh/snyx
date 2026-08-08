import { Controller, Get, Query, Param, BadRequestException } from '@nestjs/common';
import { YoutubeService } from './youtube.service';

@Controller('youtube')
export class YoutubeController {
  constructor(private youtubeService: YoutubeService) {}

  @Get('search')
  async search(
    @Query('q') query: string,
    @Query('pageToken') pageToken?: string,
    @Query('maxResults') maxResults?: string
  ) {
    if (!query || query.trim().length < 2) {
      throw new BadRequestException('Query must be at least 2 characters long.');
    }

    const parsedMaxResults = maxResults ? parseInt(maxResults, 10) : 10;
    
    return this.youtubeService.search(
      query,
      pageToken,
      isNaN(parsedMaxResults) ? 10 : parsedMaxResults
    );
  }

  @Get('video/:videoId')
  async getVideo(@Param('videoId') videoId: string) {
    return this.youtubeService.getVideo(videoId);
  }
}
