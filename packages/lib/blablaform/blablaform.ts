/*
    package that allows to create conversational forms with Generative AI
    input json schema -> AI ask questions until form is valid -> output json
*/
import { JSONSchema7 } from 'json-schema';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat';

import { BlablaSchema } from './blablaform.types';

const defaultSystemPrompt = `You role is too help fill a form that follows a JSON Schema. You will ask questions in natural language, one at a time, to the user and fill the form. Use a friendly and energetic tone. You are able to go back to previous questions if asked.`;

export class BlaBlaForm {
  schema: BlablaSchema;
  values: object;
  modelName: string;
  messages: ChatCompletionMessageParam[];
  systemPrompt?: string;
  locale?: string;
  handleLLMNewToken?: (token: string) => any;

  constructor({
    schema,
    values = {},
    modelName = 'gpt-3.5-turbo',
    messages = [],
    systemPrompt = defaultSystemPrompt,
    locale = 'en',
    handleLLMNewToken,
  }: {
    schema: BlablaSchema;
    values?: Record<string, unknown>;
    modelName?: string;
    messages?: ChatCompletionMessageParam[];
    systemPrompt?: string;
    locale?: string;
    handleLLMNewToken?: (token: string) => any;
  }) {
    this.schema = schema;
    this.values = values;
    this.modelName = modelName;
    this.locale = locale;
    this.handleLLMNewToken = handleLLMNewToken;
    const _systemPrompt = `${systemPrompt}\nWrite in the language of the following locale: ${locale}${
      values
        ? `Use the following values to fill the form ask questions about the remaining missing ones:  ${Object.keys(
            values
          )
            .map((key) => `${key}: ${values[key]}`)
            .join(', ')}`
        : ``
    }`;
    this.systemPrompt = _systemPrompt;
    this.messages = [
      {
        role: 'system',
        content: _systemPrompt,
      },
      ...messages,
    ];
  }

  static async blabla({
    schema,
    modelName,
    messages,
    handleLLMNewToken,
  }: {
    schema: BlablaSchema;
    modelName: string;
    messages: ChatCompletionMessageParam[];
    handleLLMNewToken?: (token: string) => any;
  }) {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const isStreamEnabled = Boolean(handleLLMNewToken);

    const completion = await openai.chat.completions.create({
      model: modelName,
      messages,
      stream: true,
      functions: [
        {
          name: 'isFormValid',
          description:
            'Trigger only when all the required field have been answered',
          parameters: schema,
        },
        {
          name: 'getFormValues',
          description:
            'Use this function to extract values from the conversation along with the completion',
          parameters: schema,
        },
      ],
    });

    const message = (completion as any)?.choices?.[0]?.message;
    console.log('-----------,', completion);
    // handleLLMNewToken(completion);
    // console.log(completion?.data?.choices?.[0]?.message);
    // console.log('compleltion', completion?.data?.choices?.[0]?.message);

    return {
      answer:
        (completion as any)?.choices[0].message?.function_call?.name ===
        'isFormValid'
          ? 'thank you for fill out the form'
          : message,
      isValid:
        (completion as any)?.choices[0].message?.function_call?.name ===
        'isFormValid',
      values: undefined,
    };
  }

  async run(query?: string) {
    if (query) {
      this.messages.push({
        role: 'user',
        content: query,
      });
    }

    const { answer, isValid, values } = await BlaBlaForm.blabla({
      schema: this.schema,
      messages: this.messages,
      modelName: this.modelName,
      handleLLMNewToken: this.handleLLMNewToken,
    });

    this.messages.push({
      role: 'assistant',
      content: answer,
    });

    return {
      answer,
      isValid,
      values,
    };
  }
}
