-- DropIndex
DROP INDEX "journey_cursor_grids_route_section_received_at_idx";

-- AlterTable
ALTER TABLE "journey_cursor_grids" ADD COLUMN     "is_narrow_layout" BOOLEAN,
ADD COLUMN     "viewport_height" SMALLINT,
ADD COLUMN     "viewport_width" SMALLINT;

-- CreateIndex
CREATE INDEX "journey_cursor_grids_route_section_is_narrow_layout_receive_idx" ON "journey_cursor_grids"("route", "section", "is_narrow_layout", "received_at");
