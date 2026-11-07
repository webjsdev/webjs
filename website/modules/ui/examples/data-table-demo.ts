import { paymentsTable } from '#lib/ui/data-table-demo.ts';

// shadcn's payments table: an email filter, a Columns menu, a sortable Email
// column, row selection and pagination. The table is server markup in its
// first state; <data-table-demo> (registered on every /ui page) adds the
// behaviour.
export default function DataTableDemo() {
  return paymentsTable();
}
