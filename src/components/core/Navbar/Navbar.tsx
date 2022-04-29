import { ChevronDownIcon, CloseIcon, HamburgerIcon, Icon } from '@chakra-ui/icons';
import {
  Box,
  Button,
  Flex,
  IconButton,
  Image,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  useBreakpointValue,
  useColorModeValue,
  useDisclosure,
} from '@chakra-ui/react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RiMapPin2Fill } from 'react-icons/ri';
import { useQuery } from 'react-query';

import he from '../../../assets/flags/il.svg';
import ru from '../../../assets/flags/ru.svg';
import en from '../../../assets/flags/us.svg';
import { RQ_QUERY_GET_PLACES } from '../../../constants/queries';
import { useGeolocation } from '../../../providers/GeoProvider';
import { getPlaces } from '../../../services/http/mapBox/resources';
import { LanguageVariant } from '../../../types/i18n';

const languages = {
  he,
  ru,
  en,
};

export const Navbar = () => {
  const [city, setCity] = useState('');
  const { isOpen, onToggle } = useDisclosure();
  const { isOpen: isModalOpen, onOpen: onModalOpen, onClose: onModalClose } = useDisclosure();
  const { t, i18n } = useTranslation();
  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng).catch((e) => console.error(e));
  };
  const { position } = useGeolocation();
  const { data, isLoading } = useQuery(
    [RQ_QUERY_GET_PLACES, position?.coords.latitude, position?.coords.longitude],
    () =>
      getPlaces({
        lat: position!.coords.latitude,
        lng: position!.coords.longitude,
      }),
    {
      onSuccess: (data) => setCity(data.features[0].context[0].text),
      enabled: Boolean(position),
    },
  );
  return (
    <Box>
      <Modal isOpen={isModalOpen} onClose={onModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Modal Title</ModalHeader>
          <ModalCloseButton />
          <ModalBody></ModalBody>

          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onModalClose}>
              Close
            </Button>
            <Button variant="ghost">Secondary Action</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Flex
        bg={useColorModeValue('white', 'gray.800')}
        color={useColorModeValue('gray.600', 'white')}
        minH="60px"
        py={{ base: 2 }}
        px={{ base: 4 }}
        borderBottom={1}
        borderStyle="solid"
        borderColor={useColorModeValue('gray.200', 'gray.900')}
        align="center"
      >
        <Flex flex={{ base: 1, md: 'auto' }} ml={{ base: -2 }} display={{ base: 'flex', md: 'none' }}>
          <IconButton
            onClick={onToggle}
            icon={isOpen ? <CloseIcon w={3} h={3} /> : <HamburgerIcon w={5} h={5} />}
            variant="ghost"
            aria-label="Toggle Navigation"
          />
        </Flex>
        <Flex flex={{ base: 1 }} justify={{ base: 'center', md: 'start' }}>
          <Text
            textAlign={useBreakpointValue({ base: 'center', md: 'left' })}
            fontFamily="heading"
            color={useColorModeValue('gray.800', 'white')}
          >
            {t('zmanim.title')}
          </Text>
        </Flex>

        <Stack justify="flex-end" direction="row">
          <Flex onClick={onModalOpen} cursor="pointer">
            <Flex alignItems="center">
              {city || ''}
              <IconButton ml={4} aria-label="Search database" icon={<Icon as={RiMapPin2Fill} />} />
            </Flex>
          </Flex>

          <Menu>
            {({ isOpen }) => (
              <>
                <MenuButton isActive={isOpen} as={Button} rightIcon={<ChevronDownIcon />}>
                  <Image src={languages[i18n.language as LanguageVariant]} alt="English" boxSize="25px" mr={4} />
                </MenuButton>
                <MenuList>
                  <MenuItem onClick={() => changeLanguage('en')}>
                    <Image src={languages.en} alt="English" boxSize="25px" mr={4} />
                    English
                  </MenuItem>
                  <MenuItem onClick={() => changeLanguage('ru')}>
                    <Image src={languages.ru} alt="Русский" boxSize="25px" mr={4} />
                    Русский
                  </MenuItem>
                  <MenuItem onClick={() => changeLanguage('he')}>
                    <Image src={languages.he} alt="עעברית" boxSize="25px" mr={4} />
                    עעברית
                  </MenuItem>
                </MenuList>
              </>
            )}
          </Menu>
        </Stack>
      </Flex>
    </Box>
  );
};
