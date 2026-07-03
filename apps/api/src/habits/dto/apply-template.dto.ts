import { IsIn, IsString } from 'class-validator';
import { TEMPLATE_IDS } from '../habits.service.js';

export class ApplyTemplateDto {
  @IsString()
  @IsIn(TEMPLATE_IDS)
  templateId: string;
}
