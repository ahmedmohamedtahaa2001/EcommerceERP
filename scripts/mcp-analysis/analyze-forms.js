/**
 * Analyze Forms using Playwright MCP
 * Extracts form structure, fields, validation, and submission behavior
 */

require('dotenv').config();

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET_URL = process.env.TARGET_URL || 'https://operix.co/new-landing';
const OUTPUT_DIR = './analysis';

async function analyzeForms() {
  console.log('🔍 Starting form analysis...');
  console.log(`📍 Target: ${TARGET_URL}`);

  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false',
    slowMo: parseInt(process.env.SLOW_MO || 500)
  });

  try {
    const page = await browser.newPage();

    console.log('\n📥 Navigating to target URL...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    console.log('✓ Page loaded');

    // Extract all forms
    console.log('\n📋 Extracting forms...');
    const forms = await page.evaluate(() => {
      return Array.from(document.forms).map((form, formIndex) => {
        const formData = {
          id: form.id || `form-${formIndex}`,
          name: form.name,
          action: form.action,
          method: form.method || 'POST',
          enctype: form.enctype,
          className: form.className,
          dataAttributes: Array.from(form.attributes)
            .filter(attr => attr.name.startsWith('data-'))
            .reduce((acc, attr) => {
              acc[attr.name] = attr.value;
              return acc;
            }, {}),
          fields: [],
          buttons: [],
          legend: form.querySelector('fieldset > legend')?.textContent
        };

        // Extract form fields
        Array.from(form.elements).forEach((element, index) => {
          if (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) {
            const field = {
              type: element.type || element.tagName.toLowerCase(),
              name: element.name || `field-${index}`,
              id: element.id,
              placeholder: element.placeholder,
              value: element.value?.substring(0, 100),
              required: element.required,
              disabled: element.disabled,
              readonly: element.readOnly,
              minLength: element.minLength,
              maxLength: element.maxLength,
              pattern: element.pattern,
              className: element.className,
              dataAttributes: Array.from(element.attributes)
                .filter(attr => attr.name.startsWith('data-'))
                .reduce((acc, attr) => {
                  acc[attr.name] = attr.value;
                  return acc;
                }, {}),
              validation: {},
              label: null,
              options: []
            };

            // Get associated label
            if (element.id) {
              const label = form.querySelector(`label[for="${element.id}"]`);
              field.label = label?.textContent?.trim();
            }

            // Extract validation info
            if (element.hasAttribute('required')) field.validation.required = true;
            if (element.type === 'email') field.validation.type = 'email';
            if (element.type === 'url') field.validation.type = 'url';
            if (element.type === 'number') field.validation.type = 'number';
            if (element.pattern) field.validation.pattern = element.pattern;

            // Get select options
            if (element.tagName === 'SELECT') {
              field.options = Array.from(element.options).map(option => ({
                value: option.value,
                text: option.text,
                selected: option.selected
              }));
            }

            formData.fields.push(field);
          }
        });

        // Extract submit buttons
        Array.from(form.querySelectorAll('button, input[type="submit"], input[type="button"]')).forEach(button => {
          formData.buttons.push({
            type: button.type || 'button',
            text: button.textContent?.trim() || button.value,
            name: button.name,
            className: button.className,
            id: button.id
          });
        });

        return formData;
      });
    });

    console.log(`✓ Found ${forms.length} form(s)`);

    // Extract input fields not in forms
    console.log('\n🔎 Extracting standalone inputs...');
    const standaloneInputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input, textarea, select'))
        .filter(el => !el.closest('form'))
        .map((el, index) => ({
          type: el.type || el.tagName.toLowerCase(),
          name: el.name || `standalone-${index}`,
          id: el.id,
          placeholder: el.placeholder,
          className: el.className,
          ariaLabel: el.getAttribute('aria-label'),
          ariaDescribedby: el.getAttribute('aria-describedby')
        }))
        .slice(0, 20);
    });

    console.log(`✓ Found ${standaloneInputs.length} standalone input(s)`);

    // Test form interactions
    console.log('\n⚡ Testing form interactions...');
    const formBehavior = [];

    for (let i = 0; i < Math.min(forms.length, 3); i++) {
      try {
        const form = forms[i];
        console.log(`  Testing form: ${form.id}`);

        // Try filling a field
        if (form.fields.length > 0) {
          const firstField = form.fields[0];
          const selector = firstField.id ? `#${firstField.id}` : `input[name="${firstField.name}"]`;

          try {
            const element = await page.$(selector);
            if (element) {
              const initialValue = await element.inputValue().catch(() => null);
              await element.fill('test_value_123');
              const filledValue = await element.inputValue();

              formBehavior.push({
                formId: form.id,
                action: 'fill_field',
                fieldName: firstField.name,
                initialValue: initialValue,
                filledValue: filledValue,
                success: filledValue === 'test_value_123'
              });

              // Clear the field
              await element.fill('');
            }
          } catch (e) {
            console.log(`    Field interaction error: ${e.message}`);
          }
        }
      } catch (e) {
        console.log(`  Form ${i} test error: ${e.message}`);
      }
    }

    console.log('✓ Form interaction tests complete');

    // Save results
    console.log('\n💾 Saving results...');

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'forms-analysis.json'),
      JSON.stringify({
        metadata: {
          timestamp: new Date().toISOString(),
          targetUrl: TARGET_URL,
          formsCount: forms.length,
          standaloneInputsCount: standaloneInputs.length
        },
        forms: forms,
        standaloneInputs: standaloneInputs,
        formBehavior: formBehavior
      }, null, 2)
    );

    console.log(`✓ Saved analysis to analysis/forms-analysis.json`);

    // Create summary
    const summary = {
      timestamp: new Date().toISOString(),
      targetUrl: TARGET_URL,
      statistics: {
        totalForms: forms.length,
        totalFields: forms.reduce((sum, f) => sum + f.fields.length, 0),
        totalButtons: forms.reduce((sum, f) => sum + f.buttons.length, 0),
        standaloneInputs: standaloneInputs.length
      },
      formTypes: forms.map(f => ({
        id: f.id,
        method: f.method,
        action: f.action,
        fieldCount: f.fields.length,
        buttonCount: f.buttons.length,
        fields: f.fields.map(field => ({
          name: field.name,
          type: field.type,
          required: field.required,
          validation: field.validation
        }))
      }))
    };

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'forms-summary.json'),
      JSON.stringify(summary, null, 2)
    );

    console.log('✓ Saved summary to analysis/forms-summary.json');

    console.log('\n✅ Form analysis complete!');
    console.log(`\nFound ${forms.length} form(s) with ${summary.statistics.totalFields} field(s)`);

    if (forms.length > 0) {
      console.log('\nForms summary:');
      forms.forEach(form => {
        console.log(`  • ${form.id}: ${form.fields.length} fields, ${form.buttons.length} buttons`);
      });
    }

    console.log('\nNext steps:');
    console.log('  1. Review analysis/forms-analysis.json');
    console.log('  2. Run: npm run mcp:visual-analysis');
    console.log('  3. Run: npm run mcp:extract-tokens');

  } catch (error) {
    console.error('❌ Error during analysis:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Run analysis
analyzeForms().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
