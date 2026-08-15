import {recipeFor as coreRecipeFor,recipeMeta as coreRecipeMeta,buildModelRecipeScript as buildCore} from "./model-recipes.js";
import {specialistRecipeFor,specialistRecipeMeta,buildSpecialistRecipeScript} from "./industry-specialist-recipes.js";
export function recipeFor(modelId){return coreRecipeFor(modelId)||specialistRecipeFor(modelId)}
export function buildModelRecipeScript(taskId,modelId,args={}){return coreRecipeFor(modelId)?buildCore(taskId,modelId,args):buildSpecialistRecipeScript(taskId,modelId,args)}
export function recipeMeta(){const a=coreRecipeMeta(),b=specialistRecipeMeta();return{...a,provider:"kaggle-bounded-model-recipes",methods:[...new Set([...a.methods,...b.methods])].sort(),recipe_families:[...new Set([...a.recipe_families,...b.recipe_families])].sort(),core_methods:a.methods.length,specialist_methods:b.methods.length,specialist_provider:b.provider,arbitrary_code:false,enable_internet:false}}
