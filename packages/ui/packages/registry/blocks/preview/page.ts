/**
 * The preview block's page: thirty-one cards built from the kit, laid out in
 * seven columns, the sheet the design-system configurator previews a style
 * on.
 *
 * Installed by `npx @webjsdev/ui add preview` at `app/preview/page.ts`, with
 * each card at `components/preview/<card>.ts`. It is app code you own, so edit
 * it freely. Ported from shadcn/ui's preview block.
 */
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import { activateAgentDialog } from './cards/activate-agent-dialog.ts';
import { analyticsCard } from './cards/analytics-card.ts';
import { anomalyAlert } from './cards/anomaly-alert.ts';
import { barChartCard } from './cards/bar-chart-card.ts';
import { bookAppointment } from './cards/book-appointment.ts';
import { codespacesCard } from './cards/codespaces-card.ts';
import { contributionsActivity } from './cards/contributions-activity.ts';
import { contributors } from './cards/contributors.ts';
import { environmentVariables } from './cards/environment-variables.ts';
import { feedbackForm } from './cards/feedback-form.ts';
import { fileUpload } from './cards/file-upload.ts';
import { githubProfile } from './cards/github-profile.ts';
import { iconPreviewGrid } from './cards/icon-preview-grid.ts';
import { inviteTeam } from './cards/invite-team.ts';
import { invoice } from './cards/invoice.ts';
import { liveWaveformCard } from './cards/live-waveform.ts';
import { noTeamMembers } from './cards/no-team-members.ts';
import { notFound } from './cards/not-found.ts';
import { observabilityCard } from './cards/observability-card.ts';
import { pieChartCard } from './cards/pie-chart-card.ts';
import { reportBug } from './cards/report-bug.ts';
import { shippingAddress } from './cards/shipping-address.ts';
import { shortcuts } from './cards/shortcuts.ts';
import { skeletonLoading } from './cards/skeleton-loading.ts';
import { sleepReport } from './cards/sleep-report.ts';
import { styleOverview } from './cards/style-overview.ts';
import { typographySpecimen } from './cards/typography-specimen.ts';
import { uiElements } from './cards/ui-elements.ts';
import { usageCard } from './cards/usage-card.ts';
import { visitors } from './cards/visitors.ts';
import { weeklyFitnessSummary } from './cards/weekly-fitness-summary.ts';

export const metadata: Metadata = { title: 'Preview' };

const COLUMN = 'flex flex-col p-1 [contain-intrinsic-size:380px_1200px] [content-visibility:auto]';

export default function PreviewPage() {
  return html`
    <div class="overflow-x-auto overflow-y-hidden bg-muted contain-[paint] [--gap:--spacing(4)] 3xl:[--gap:--spacing(12)] md:[--gap:--spacing(10)] dark:bg-background style-lyra:md:[--gap:--spacing(6)] style-mira:md:[--gap:--spacing(6)]">
      <div class="flex w-full min-w-max justify-center">
        <div class="grid w-[2400px] grid-cols-7 items-start gap-(--gap) bg-muted p-(--gap) md:w-[3000px] dark:bg-background style-lyra:md:w-[2600px] style-mira:md:w-[2600px] *:[div]:gap-(--gap)" data-slot="capture-target">
          <div class=${COLUMN}>
            ${styleOverview()}
            ${typographySpecimen()}
            <div class="md:hidden">${uiElements()}</div>
            ${codespacesCard()}
            ${invoice()}
          </div>
          <div class=${COLUMN}>
            ${iconPreviewGrid()}
            <div class="hidden w-full md:flex">${uiElements({ id: 'ui-elements-md' })}</div>
            ${observabilityCard()}
            ${shippingAddress()}
          </div>
          <div class=${COLUMN}>
            ${environmentVariables()}
            ${barChartCard()}
            ${inviteTeam()}
            ${activateAgentDialog()}
          </div>
          <div class=${COLUMN}>
            ${skeletonLoading()}
            ${pieChartCard()}
            ${noTeamMembers()}
            ${reportBug()}
            ${contributors()}
          </div>
          <div class=${COLUMN}>
            ${feedbackForm()}
            ${bookAppointment()}
            ${sleepReport()}
            ${githubProfile()}
          </div>
          <div class=${COLUMN}>
            ${weeklyFitnessSummary()}
            ${fileUpload()}
            ${analyticsCard()}
            ${usageCard()}
            ${shortcuts()}
          </div>
          <div class=${COLUMN}>
            ${anomalyAlert()}
            ${liveWaveformCard()}
            ${visitors()}
            ${contributionsActivity()}
            ${notFound()}
          </div>
        </div>
      </div>
    </div>
  `;
}
