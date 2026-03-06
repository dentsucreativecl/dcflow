import ListPage from "./client-page";

export const dynamicParams = true;

export function generateStaticParams() {
  // Pre-generate a placeholder page, actual data loaded client-side
  return [{ listId: '_' }];
}

export default function Page() {
  return <ListPage />;
}
