-- Reviewed module operation fd5131f8c5e4b9c9aec7553667a0c968
BEGIN;
SET LOCAL lock_timeout = '10s';
DELETE FROM "record_activities" WHERE model IN ('ContactosextraPartnertags', 'ContactosextraCorePartner', 'ContactosextraCorePartnerTagIdsLink');
DELETE FROM "access_model_overrides" WHERE model IN ('contactosextra.partnertags', 'contactosextra.corepartner', 'contactosextra.corepartnertagidslink');
-- DropForeignKey
ALTER TABLE "contactosextra_partnertags" DROP CONSTRAINT "contactosextra_partnertags_create_by_fkey";

-- DropForeignKey
ALTER TABLE "contactosextra_core_partner" DROP CONSTRAINT "contactosextra_core_partner_record_id_fkey";

-- DropForeignKey
ALTER TABLE "contactosextra_core_partner" DROP CONSTRAINT "contactosextra_core_partner_pais_id_fkey";

-- DropForeignKey
ALTER TABLE "contactosextra_core_partner" DROP CONSTRAINT "contactosextra_core_partner_estado_id_fkey";

-- DropForeignKey
ALTER TABLE "contactosextra_core_partner" DROP CONSTRAINT "contactosextra_core_partner_municipio_id_fkey";

-- DropForeignKey
ALTER TABLE "contactosextra_core_partner" DROP CONSTRAINT "contactosextra_core_partner_localidad_id_fkey";

-- DropForeignKey
ALTER TABLE "contactosextra_core_partner" DROP CONSTRAINT "contactosextra_core_partner_sale_user_id_fkey";

-- DropForeignKey
ALTER TABLE "contactosextra_core_partner" DROP CONSTRAINT "contactosextra_core_partner_purchase_user_id_fkey";

-- DropForeignKey
ALTER TABLE "contactosextra_core_partner" DROP CONSTRAINT "contactosextra_core_partner_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "contactosextra_core_partner" DROP CONSTRAINT "contactosextra_core_partner_create_by_fkey";

-- DropForeignKey
ALTER TABLE "contactosextra_core_partner_tag_ids_rel" DROP CONSTRAINT "contactosextra_core_partner_tag_ids_rel_source_id_fkey";

-- DropForeignKey
ALTER TABLE "contactosextra_core_partner_tag_ids_rel" DROP CONSTRAINT "contactosextra_core_partner_tag_ids_rel_target_id_fkey";

-- DropTable
DROP TABLE "contactosextra_partnertags";

-- DropTable
DROP TABLE "contactosextra_core_partner";

-- DropTable
DROP TABLE "contactosextra_core_partner_tag_ids_rel";

-- DropEnum
DROP TYPE "contactosextra_core_partner_partner_type";


COMMIT;
