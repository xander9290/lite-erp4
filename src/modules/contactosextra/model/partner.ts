import "server-only";
import { Fields } from "@/lib/orm";
import { extendModel } from "@/lib/modules/extend";
import { Partner } from "@/lib/core/models/partner";

export const PartnerExtra = extendModel(Partner, (Base) => {
  class PartnerExtra extends Base {
    street = Fields.Text({
      label: "Calle",
      maxLength: 160,
      tracking: true,
    });
  }

  return PartnerExtra;
});
