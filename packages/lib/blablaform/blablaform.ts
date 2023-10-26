/*
    package that allows to create conversational forms with Generative AI
    input json schema -> AI ask questions until form is valid -> output json
*/
import { JSONSchema7 } from 'json-schema';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat';

const defaultSystemPrompt = `You role is too help fill a form that follows a JSON Schema. You will ask questions in natural language, one at a time, to the user and fill the form. Use a friendly and energetic tone. You are able to go back to previous questions if asked.`;

export class BlaBlaForm {
  schema: JSONSchema7;
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
    schema: JSONSchema7;
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
    schema: JSONSchema7;
    modelName: string;
    messages: ChatCompletionMessageParam[];
    handleLLMNewToken?: (token: string) => any;
  }) {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    //   const prompt = json
    //   ? `extractData Current Value: ${JSON.stringify(json)}\nContent: ${each}`
    //   : each;

    const isStreamEnabled = Boolean(handleLLMNewToken);

    const completion = await openai.chat.completions.create({
      model: modelName,
      messages,
      // stream: isStreamEnabled ? true : false,
      functions: [
        {
          name: 'isFormValid',
          description:
            'Trigger when the form is valid and all questions have been asked',
          parameters: schema as any,
        },
        // {
        //   name: 'getFormValues',
        //   description:
        //     'Use this function to extract values from the conversation along with the completion',
        //   parameters: schema,
        // },
      ],
    });

    for await (const part of completion as any) {
      handleLLMNewToken?.(part.choices[0]?.delta?.content);
    }

    // let message = '';

    // const message = completion?.choices?.[0]?.message;
    const message = completion?.choices?.[0]?.message;

    // console.log(completion?.data?.choices?.[0]?.message);
    // console.log('compleltion', completion?.data?.choices?.[0]?.message);

    return {
      answer: message?.content,
      isValid: !message?.content,
      values: message?.function_call?.arguments
        ? JSON.parse(message?.function_call?.arguments)
        : undefined,
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
