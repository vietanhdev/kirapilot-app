import React, { type ReactNode } from 'react';
import type DocBreadcrumbsType from '@theme/DocBreadcrumbs';
import type { WrapperProps } from '@docusaurus/types';
import BreadcrumbNavigation from '../../components/BreadcrumbNavigation';

type Props = WrapperProps<typeof DocBreadcrumbsType>;

export default function DocBreadcrumbsWrapper(_props: Props): ReactNode {
  // Use our enhanced breadcrumb navigation instead of the default
  return (
    <>
      <BreadcrumbNavigation />
    </>
  );
}
