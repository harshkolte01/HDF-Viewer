const templateCache = new Map();

const PLACEHOLDER_PATTERN = /\{\{([A-Z0-9_]+)\}\}/g;

function getTemplateUrl(templateName) {
  return new URL(`../../pages/${templateName}.html`, import.meta.url).href;
}

export async function loadTemplate(templateName) {
  if (templateCache.has(templateName)) {
    return templateCache.get(templateName);
  }

  const response = await fetch(getTemplateUrl(templateName), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load template "${templateName}"`);
  }

  const template = (await response.text()).trim();
  templateCache.set(templateName, template);
  return template;
}

export function applyTemplate(template, values = {}) {
  if (typeof template !== "string" || !template) {
    return "";
  }

  return template.replace(PLACEHOLDER_PATTERN, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) {
      return match;
    }

    const value = values[key];
    return value == null ? "" : String(value);
  });
}
