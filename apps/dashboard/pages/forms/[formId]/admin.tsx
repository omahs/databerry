import { AutoAwesomeMosaicOutlined, RocketLaunch } from '@mui/icons-material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Box,
  Button,
  Card,
  IconButton,
  Input,
  Stack,
  Tab,
  tabClasses,
  TabList,
  Tabs,
  Typography,
} from '@mui/joy';
import cuid from 'cuid';
import { useRouter } from 'next/router';
import { GetServerSidePropsContext } from 'next/types';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';

import Layout from '@app/components/Layout';
import useChat from '@app/hooks/useChat';
import { getProductFromHostname } from '@app/hooks/useProduct';
import useStateReducer from '@app/hooks/useStateReducer';
import { getForm } from '@app/pages/api/forms/[formId]';
import { updateForm } from '@app/pages/api/forms/[formId]/admin';
import { publishForm } from '@app/pages/api/forms/[formId]/publish';

import {
  fetcher,
  generateActionFetcher,
  HTTP_METHOD,
} from '@chaindesk/lib/swr-fetcher';
import { withAuth } from '@chaindesk/lib/withAuth';
import { Prisma } from '@chaindesk/prisma';

import { isEmpty } from '..';

interface FormDashboardProps {}

type Field = {
  id: string;
  fieldName: string;
  required: boolean;
};

function FormDashboard(props: FormDashboardProps) {
  const [state, setState] = useStateReducer({
    fields: [] as Field[],
    currentAnswer: '',
    isConversationStarted: false,
    isFormCompleted: false,
    isPublishable: false,
  });

  const router = useRouter();

  const formId = useMemo(() => router.query.formId, [router.query.formId]);
  const getFormQuery = useSWR<Prisma.PromiseReturnType<typeof getForm>>(
    formId ? `/api/forms/${formId}` : null,
    fetcher
  );

  const updateFormMutation = useSWRMutation<
    Prisma.PromiseReturnType<typeof updateForm>
  >(`/api/forms/${formId}/admin`, generateActionFetcher(HTTP_METHOD.PATCH));

  const publishFormMutation = useSWRMutation<
    Prisma.PromiseReturnType<typeof publishForm>
  >(`/api/forms/${formId}/publish`, generateActionFetcher(HTTP_METHOD.POST));

  const chatData = useChat({
    endpoint: `/api/forms/${formId}/chat`,
  });

  useEffect(() => {
    setState({
      fields: ((getFormQuery.data?.draftConfig as any)?.fields ||
        []) as Field[],
    });
  }, [getFormQuery.data]);

  useEffect(() => {
    localStorage.setItem('conversationId', '');
  }, []);

  React.useEffect(() => {
    if (typeof window !== 'undefined' && !router.query.tab) {
      handleChangeTab('settings');
    }
  }, [router.query.tab]);

  // TODO: turn the field methods into a reducer!
  const addField = () => {
    setState({
      fields: [
        ...state?.fields,
        { id: cuid(), fieldName: '', required: false },
      ],
      isPublishable: false,
    });
  };

  const deleteField = (id: string) => {
    setState({
      fields: state?.fields?.filter((field) => field.id !== id),
      isPublishable: state.fields.length > 0,
    });
  };

  const changeField = ({
    id,
    newFieldName,
  }: {
    id: string;
    newFieldName: string;
  }) => {
    setState({
      fields: state.fields.map((field) =>
        field.id === id ? { ...field, fieldName: newFieldName } : field
      ),
      isPublishable: newFieldName.trim() !== '',
    });
  };

  const handleChangeTab = (tab: string) => {
    router.query.tab = tab;
    router.replace(router);
  };

  const handlePublish = async () => {
    await toast.promise(publishFormMutation.trigger(), {
      loading: 'Publishing...',
      success: 'Published!',
      error: 'Something went wrong',
    });
  };

  const answerQuestion = async (answer: string) => {
    await chatData.handleChatSubmit(answer);
  };

  const save = async () => {
    await toast.promise(
      updateFormMutation.trigger({
        draftConfig: { fields: state?.fields },
      } as any),
      {
        loading: 'saving...',
        success: 'saved!',
        error: 'Something went wrong',
      }
    );
  };

  const initiateForm = () => {
    localStorage.setItem('conversationId', '');
    setState({ isConversationStarted: true });
    answerQuestion(
      'I am ready, to fill the form. prompt me with informations you need.'
    );
  };

  return (
    <Box
      component="main"
      className="MainContent"
      sx={(theme) => ({
        px: {
          xs: 2,
          md: 6,
        },
        pb: {
          xs: 2,
          sm: 2,
          md: 3,
        },
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        width: '100%',
        gap: 1,
      })}
    >
      <Stack direction={'row'} gap={2} alignItems={'center'}>
        <Tabs
          aria-label="tabs"
          value={(router.query.tab as string) || 'chat'}
          size="md"
          sx={{
            bgcolor: 'transparent',
            width: '100%',
          }}
          onChange={(event, value) => {
            handleChangeTab(value as string);
          }}
        >
          <TabList
            size="sm"
            sx={{
              [`&& .${tabClasses.root}`]: {
                flex: 'initial',
                bgcolor: 'transparent',
                '&:hover': {
                  bgcolor: 'transparent',
                },
                [`&.${tabClasses.selected}`]: {
                  color: 'primary.plainColor',
                  '&::after': {
                    height: '3px',
                    borderTopLeftRadius: '3px',
                    borderTopRightRadius: '3px',
                    bgcolor: 'primary.500',
                  },
                },
              },
            }}
          >
            <Tab indicatorInset value={'preview'}>
              Preview
            </Tab>

            <Tab indicatorInset value={'settings'}>
              Settings
            </Tab>
          </TabList>
        </Tabs>
      </Stack>
      <Card>
        {router.query.tab === 'settings' && (
          <>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'flex-end',
                width: '100%',
              }}
            >
              <Button
                variant="outlined"
                disabled={!state.isPublishable}
                startDecorator={<RocketLaunch />}
                onClick={handlePublish}
              >
                Publish Form
              </Button>
            </Box>
            <Box>
              <Typography level="title-md">Informations To Collect</Typography>
              <Typography level="body-sm"></Typography>
            </Box>
            <Box>
              {state?.fields?.map((field) => (
                <Box
                  key={field.id}
                  display="flex"
                  alignItems="center"
                  marginBottom={2}
                >
                  <Input
                    variant="soft"
                    defaultValue={field.fieldName}
                    onBlur={(e) =>
                      changeField({
                        id: field.id,
                        newFieldName: e.target.value,
                      })
                    }
                    sx={{ mx: 2, width: '100%' }}
                  />
                  <IconButton
                    size="sm"
                    variant="outlined"
                    onClick={() => deleteField(field.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              ))}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  width: '100%',
                }}
              >
                <Button
                  variant="outlined"
                  startDecorator={<AddIcon />}
                  onClick={addField}
                >
                  Add another field
                </Button>
              </Box>

              <Button variant="outlined" onClick={save}>
                Save
              </Button>
            </Box>
          </>
        )}

        {router.query.tab === 'preview' && (
          <Box
            height="100%"
            minHeight="400px"
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
          >
            {isEmpty(getFormQuery.data?.publishedConfig) ? (
              <Typography>You need to publish your form first</Typography>
            ) : (
              <Box>
                <Box width="100%" display="flex" sx={{ textAlign: 'center' }}>
                  {chatData.history.length > 0 &&
                    chatData?.history[chatData.history.length - 1].from ===
                      'agent' && (
                      <Typography>
                        {chatData?.history[chatData.history.length - 1].message}
                      </Typography>
                    )}
                  {chatData.isStreaming && (
                    <span className="inline-block w-0.5 h-4 bg-current animate-typewriterCursor"></span>
                  )}
                </Box>
                <Box
                  width="100%"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  sx={{ textAlign: 'center', mt: '20px' }}
                >
                  {!chatData.isStreaming &&
                    !chatData.isFomValid &&
                    state.isConversationStarted && (
                      <input
                        autoFocus
                        className="bg-transparent outline-none text-xl"
                        placeholder="Type your answer "
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            answerQuestion(state.currentAnswer);
                          }
                        }}
                        onChange={(e) =>
                          setState({ currentAnswer: e.target.value })
                        }
                      />
                    )}
                </Box>
                {!state.isConversationStarted && (
                  <Button variant="outlined" onClick={initiateForm}>
                    Start A New Inquiry
                  </Button>
                )}
              </Box>
            )}
          </Box>
        )}
      </Card>
    </Box>
  );
}

export default FormDashboard;

FormDashboard.getLayout = function getLayout(page: React.ReactElement) {
  return <Layout>{page}</Layout>;
};

export const getServerSideProps = withAuth(
  async (ctx: GetServerSidePropsContext) => {
    return {
      props: {
        product: getProductFromHostname(ctx?.req?.headers?.host),
      },
    };
  }
);
