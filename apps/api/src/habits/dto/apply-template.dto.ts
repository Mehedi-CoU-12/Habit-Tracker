import { IsString } from 'class-validator';

export class ApplyTemplateDto {
  @IsString()
  templateId: string;
}
