import { SetMetadata } from '@nestjs/common';

export const ALLOW_INACTIVE = 'allowInactive';
export const AllowInactive = () => SetMetadata(ALLOW_INACTIVE, true);
