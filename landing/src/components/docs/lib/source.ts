import { create } from '../../../../source.generated';

export const docs = create.doc(
  'docs',
  '/docs',
  import.meta.glob('../content/pages/**/*.mdx'),
);
