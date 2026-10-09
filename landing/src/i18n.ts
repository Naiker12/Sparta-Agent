/** Spanish demo adapter for the image utility shared with the desktop. */
import { ui } from '../../desktop/frontend-spartan/src/i18n/locales/es/ui';

const imageMessages = {
  'ui.could_not_load_image': ui.could_not_load_image,
  'ui.canvas_not_available': ui.canvas_not_available,
  'ui.invalid_image_dimensions': ui.invalid_image_dimensions,
  'ui.image_is_still_too_large_after_compression_try_a_smaller_file': ui.image_is_still_too_large_after_compression_try_a_smaller_file,
};

export function translate(key: keyof typeof imageMessages): string {
  return imageMessages[key];
}
