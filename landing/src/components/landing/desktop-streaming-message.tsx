import { memo, useMemo, useRef } from 'react';
import { Block, Streamdown, type BlockProps } from 'streamdown';
import { stabilizeStreamingMarkdown } from '../../../../desktop/frontend-spartan/src/components/assistant-ui/streaming-markdown';
import { IncrementalMarkdownCache, withoutStreamdownAnimationPlugin } from '../../../../desktop/frontend-spartan/src/components/assistant-ui/streaming-render-schedule';
import { safeMarkdownUrl } from '../../../../desktop/frontend-spartan/src/lib/safe-markdown-url';

const immediateUpdates = { duration: 0, stagger: 0 };
const DesktopBlock = memo(function DesktopBlock(props: BlockProps) {
  const rehypePlugins = useMemo(
    () => withoutStreamdownAnimationPlugin(props.rehypePlugins, props.animatePlugin),
    [props.rehypePlugins, props.animatePlugin],
  );
  return <Block {...props} animatePlugin={null} rehypePlugins={rehypePlugins} />;
});

/** Browser adapter for the desktop's pure Markdown pipeline; no Electron runtime. */
export function DesktopStreamingMessage({ text, running, messageId }: {
  text: string; running: boolean; messageId: string;
}) {
  const cacheRef = useRef({ messageId, cache: new IncrementalMarkdownCache() });
  if (cacheRef.current.messageId !== messageId) {
    cacheRef.current = { messageId, cache: new IncrementalMarkdownCache() };
  }
  const processed = stabilizeStreamingMarkdown(text, running);
  const cache = cacheRef.current.cache;
  const incremental = running ? cache.update(processed) : null;
  return <div className="demo-streamdown" data-status={running ? 'running' : 'complete'}>
    <Streamdown key={`${messageId}:${cache.renderGeneration}`} mode="streaming"
      parseIncompleteMarkdown={!incremental}
      parseMarkdownIntoBlocksFn={incremental?.parseMarkdownIntoBlocks}
      isAnimating={running} animated={immediateUpdates} BlockComponent={DesktopBlock}
      urlTransform={safeMarkdownUrl} controls={{ code: false }}>
      {incremental?.markdown ?? processed}
    </Streamdown>
  </div>;
}
