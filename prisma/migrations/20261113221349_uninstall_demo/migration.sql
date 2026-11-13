-- Reviewed module operation 8de7e75e178b7347ab41fcc20edc6d6e
BEGIN;
SET LOCAL lock_timeout = '10s';
DELETE FROM "public"."record_activities" WHERE model IN ('DemoTarea', 'DemoCategoria');
DELETE FROM "public"."access_user_groups" WHERE group_id IN ('demo.usuario', 'demo.responsable');
DELETE FROM "public"."access_model_overrides" WHERE group_id IN ('demo.usuario', 'demo.responsable') OR model IN ('demo.tarea', 'demo.categoria');
DELETE FROM "public"."access_rule_states" WHERE rule_id IN ('demo.tareas-propias', 'demo.tareas-todas');
-- DropForeignKey
ALTER TABLE "demo_tarea" DROP CONSTRAINT "demo_tarea_categoria_fkey";

-- DropForeignKey
ALTER TABLE "demo_tarea" DROP CONSTRAINT "demo_tarea_create_by_fkey";

-- DropForeignKey
ALTER TABLE "demo_categoria" DROP CONSTRAINT "demo_categoria_create_by_fkey";

-- DropTable
DROP TABLE "demo_tarea";

-- DropTable
DROP TABLE "demo_categoria";

-- DropEnum
DROP TYPE "demo_tarea_estado";


COMMIT;
