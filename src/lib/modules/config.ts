import type { FieldMetadata } from "../orm/fields";
import type { ReactionRule } from "../orm/reactions.types";
import type { ListViewConfig } from "../list/types";

/** Serializable, browser-safe description of a module model. Never contains functions or server classes. */
export type ModelClientConfig = {
  readonly id: string;
  readonly module: string;
  readonly moduleName: string;
  readonly key: string;
  readonly name: string;
  readonly label: string;
  readonly route: string;
  readonly fields: Readonly<Record<string, FieldMetadata>>;
  readonly preview: Readonly<Record<string, FieldMetadata>>;
  readonly related: readonly string[];
  readonly reactionRules: readonly ReactionRule[];
  /** Many2one field → target module model id with an authorized lookup. */
  readonly lookups: Readonly<Record<string, string>>;
  readonly list: {
    readonly fields: readonly string[];
    readonly searchFields: readonly string[];
    readonly sortable: readonly string[];
    readonly groupable: readonly string[];
    readonly filterable: readonly string[];
  };
  readonly view: "list" | "card";
  readonly kanban?: string;
  readonly defaultSort?: ListViewConfig["defaultSort"];
};

export const modelIdPattern = /^[a-z][a-z0-9]*\.[a-z][a-z0-9]*$/;
