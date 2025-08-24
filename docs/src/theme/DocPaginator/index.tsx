import React, { type ReactNode } from 'react';
import DocPaginator from '@theme-original/DocPaginator';
import type DocPaginatorType from '@theme/DocPaginator';
import type { WrapperProps } from '@docusaurus/types';
import PageProgression from '../../components/PageProgression';

type Props = WrapperProps<typeof DocPaginatorType>;

export default function DocPaginatorWrapper(props: Props): ReactNode {
  // Extract previous and next from props if available
  const { previous, next } = props;

  return (
    <>
      <DocPaginator {...props} />
      {(previous || next) && (
        <PageProgression previous={previous} next={next} />
      )}
    </>
  );
}
