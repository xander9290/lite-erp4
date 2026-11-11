"use server";

import { requireAdmin } from "@/lib/auth/access";
import { createModelImageSigner } from "@/lib/uploads/model-image.server";
import { sampleImageModel } from "./image.model";

const sign = createModelImageSigner({ authorize: requireAdmin }, sampleImageModel, ["image"]);

export async function signSampleImage() { return sign("image"); }
