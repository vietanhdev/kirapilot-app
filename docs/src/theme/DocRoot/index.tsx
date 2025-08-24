import React, { type ReactNode } from 'react';
import { useLocation } from '@docusaurus/router';
import DocRoot from '@theme-original/DocRoot';
import type DocRootType from '@theme/DocRoot';
import type { WrapperProps } from '@docusaurus/types';
import RelatedContent, {
  useRelatedContent,
} from '../../components/RelatedContent';

type Props = WrapperProps<typeof DocRootType>;

export default function DocRootWrapper(props: Props): ReactNode {
  const location = useLocation();
  const relatedContent = useRelatedContent(location.pathname);

  // Only show enhancements on documentation pages
  const isDocsPage = location.pathname.startsWith('/docs/');

  return (
    <>
      <DocRoot {...props} />
      {isDocsPage && relatedContent.length > 0 && (
        <RelatedContent items={relatedContent} />
      )}
    </>
  );
}
