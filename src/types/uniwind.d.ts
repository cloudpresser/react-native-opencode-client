import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    className?: string;
  }
  interface TextProps {
    className?: string;
  }
  interface TextInputProps {
    className?: string;
  }
  interface TouchableOpacityProps {
    className?: string;
  }
  interface PressableProps {
    className?: string;
  }
  interface FlatListProps<T> {
    contentContainerClassName?: string;
    columnWrapperClassName?: string;
  }
  interface ScrollViewProps {
    contentContainerClassName?: string;
  }
  interface ImageProps {
    className?: string;
  }
  interface ActivityIndicatorProps {
    className?: string;
  }
  interface SwitchProps {
    className?: string;
  }
  interface ModalProps {
    className?: string;
  }
}