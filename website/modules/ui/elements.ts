/**
 * Every Tier-2 element of the kit, imported once so they register on every
 * /ui page (#1666, D14), plus the two Tier-1 modules whose look needs their
 * module in the browser: checkbox and radio-group inject the stylesheet that
 * draws the tick and the dot.
 *
 * A docs demo reaches the page as a rendered string (renderDemo), so the
 * page's own imports cannot say which elements it holds. app/ui/layout.ts
 * imports this barrel instead, and the browser loads each element module
 * once per session. Generated from the registry's elements; add a new one
 * here when the kit gains it.
 */
import '#modules/ui/components/alert-dialog.ts';
import '#modules/ui/components/calendar.ts';
import '#modules/ui/components/carousel.ts';
import '#modules/ui/components/checkbox.ts';
import '#modules/ui/components/code-block.ts';
import '#modules/ui/components/combobox.ts';
import '#modules/ui/components/command.ts';
import '#modules/ui/components/context-menu.ts';
import '#modules/ui/components/dialog.ts';
import '#modules/ui/components/drawer.ts';
import '#modules/ui/components/dropdown-menu.ts';
import '#modules/ui/components/hover-card.ts';
import '#modules/ui/components/input-otp.ts';
import '#modules/ui/components/menubar.ts';
import '#modules/ui/components/message-scroller.ts';
import '#modules/ui/components/navigation-menu.ts';
import '#modules/ui/components/questionnaire.ts';
import '#modules/ui/components/radio-group.ts';
import '#modules/ui/components/resizable.ts';
import '#modules/ui/components/select.ts';
import '#modules/ui/components/sheet.ts';
import '#modules/ui/components/sidebar.ts';
import '#modules/ui/components/slider.ts';
import '#modules/ui/components/switch.ts';
import '#modules/ui/components/sonner.ts';
import '#modules/ui/components/tabs.ts';
import '#modules/ui/components/toggle.ts';
import '#modules/ui/components/toggle-group.ts';
import '#modules/ui/components/tooltip.ts';
