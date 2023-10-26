import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Input,
  Stack,
  Typography,
} from '@mui/joy';
import { useRouter } from 'next/router';
import React, { ReactElement, useEffect, useMemo } from 'react';
import superjson from 'superjson';
import useSWR from 'swr';

import SEO from '@app/components/SEO';
import useChat from '@app/hooks/useChat';
import useStateReducer from '@app/hooks/useStateReducer';
import { getAgent } from '@app/pages/api/agents/[id]';

import pickColorBasedOnBgColor from '@chaindesk/lib/pick-color-based-on-bgcolor';
import { fetcher } from '@chaindesk/lib/swr-fetcher';
import { AgentInterfaceConfig } from '@chaindesk/lib/types/models';
import { Agent, Prisma } from '@chaindesk/prisma';
import { prisma } from '@chaindesk/prisma/client';

export default function FormPage(props: { agent: Agent }) {
  const router = useRouter();

  const formId = router.query.formId as string;

  const [state, setState] = useStateReducer({
    isPageReady: true,
    form: undefined as Agent | undefined,
    config: {},
  });

  // const getAgentConfigQuery = useSWR<Prisma.PromiseReturnType<typeof getAgent>>(
  //   `/api/forms/${formId}`,
  //   fetcher
  // );

  const methods = useChat({
    endpoint: `/api/forms/chat`,
    queryBody: {
      // chainType: state.currentChainType,
      formId,
    },
    localStorageConversationIdKey: 'formConversationId',
  });

  // useEffect(() => {
  //   if (getAgentConfigQuery?.isLoading) {
  //     setTimeout(() => {
  //       setState({
  //         isPageReady: true,
  //       });
  //     }, 0);
  //   }
  // }, [getAgentConfigQuery?.isLoading]);

  console.log('history', methods.history);

  return (
    <>
      {/*

      <SEO
        title={`${props?.agent?.name} - made with Chaindesk`}
        description={props?.agent?.description}
        url={`https://chaindesk.ai/@${props?.agent?.handle}`}
      />
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Pacifico&display=swap"
          rel="stylesheet"
        />
      </Head>

*/}
      {false ? (
        // {!state.form || !state.isPageReady ? (
        <Stack
          sx={{
            width: '100vw',
            height: '100vh',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Stack
            gap={3}
            sx={{ justifyContent: 'center', alignItems: 'center' }}
          >
            <CircularProgress color="neutral" />
            <a
              href="https://chaindesk.ai"
              target="_blank"
              style={{
                textDecoration: 'none',
              }}
            >
              <Box>
                <Typography level="body-sm">
                  Powered by{' '}
                  <Typography color="primary" fontWeight={'bold'}>
                    BlaBlaForm
                  </Typography>
                </Typography>
              </Box>
            </a>
          </Stack>
        </Stack>
      ) : (
        <Stack
          sx={{
            width: '100vw',
            height: '100vh',
          }}
        >
          {/* <Input  /> */}
          <Button
            onClick={() => {
              methods.handleChatSubmit('Hello World');
            }}
          >
            Trigger Chat Submit
          </Button>
        </Stack>
      )}
    </>
  );
}

// FormPage.getLayout = function getLayout(page: ReactElement) {
//   return <SessionProvider>{page}</SessionProvider>;
// };

// export async function getStaticPaths() {
//   const all: string[] = [];

//   return {
//     paths: all.map((path) => {
//       return { params: { site: path } };
//     }),
//     fallback: 'blocking',
//   };
// }

// export async function getStaticProps({
//   params: { agentId },
// }: {
//   params: {
//     agentId: string;
//   };
// }) {
//   let agent = null;

//   if (agentId.startsWith('@')) {
//     const handle = agentId.replace('@', '');

//     agent = await prisma.agent.findUnique({
//       where: {
//         handle,
//       },
//     });
//   } else {
//     agent = await prisma.agent.findUnique({
//       where: {
//         id: agentId,
//       },
//     });
//   }

//   if (!agent) {
//     return {
//       redirect: {
//         destination: `/`,
//       },
//     };
//   }

//   return {
//     props: {
//       agent: superjson.serialize(agent).json || null,
//     },
//     revalidate: 10,
//   };
// }
