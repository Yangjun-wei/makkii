import React from 'react';
import { ImageBackground, Animated, View, Text, Dimensions, FlatList, TouchableOpacity, StyleSheet, Image, BackHandler, Platform, Keyboard } from 'react-native';
import { connect } from 'react-redux';
import { getStatusBarHeight, hashPassword } from '../../utils';
import { strings } from '../../locales/i18n';
import { AppToast } from '../components/AppToast';
import { createAction } from '../../utils/dva';
import { showTouchID } from '../../utils/touchId';

const { height } = Dimensions.get('window');
const KeyboardData = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'cancel', '0', 'delete'];
const KeyboardDataWithTouchID = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'cancel', '0', 'delete', 'blank', 'biometry', 'blank'];
const MaxPinCodeLength = 6;
const isSmallScreen = height < 569;

const mColor = '#fff';

class PinCodeScreen extends React.Component {
    /** *********************************************************
     * 1. create pin Code process:
     *     create pinCode -> confirm pinCode -> another screen
     * (pinState)  1 -> 2
     * 2. modify pin Code process:
     *     enter old pinCode -> create  -> confirm -> another screen
     * (pinState) 0 -> 1 -> 2
     * 3. unlock screen
     *     enter pinCode -> another screen
     * (pinState) 0
     ********************************************************** */

    isShake = false;

    animatedValue = new Animated.Value(0);

    createPinCode = '';

    constructor(props) {
        super(props);
        this.errorCounts = 0;
        this.isModifyPinCode = this.props.navigation.getParam('isModifyPinCode', false);
        this.onUnlockSuccess = this.props.navigation.getParam('onUnlockSuccess', () => {});
        this.targetScreen = this.props.navigation.getParam('targetScreen');
        this.targetScreenArgs = this.props.navigation.getParam('targetScreenArgs', {});
        this.cancel = this.props.navigation.getParam('cancel', true);
        this.state = {
            pinCode: '',
            pinState: this.props.hashed_pinCode === '' ? 1 : 0,
            errorMsg: null,
        };
    }

    // eslint-disable-next-line react/sort-comp
    onGoback() {
        this.cancel && this.props.navigation.goBack();
    }

    componentDidMount() {
        Keyboard.dismiss();
        setTimeout(
            () => {
                this.cancel && this.onPressTouchId();
            },
            Platform.OS === 'ios' ? 1000 : 100,
        );
        this.backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            this.onGoback(); // works best when the goBack is async
            return true;
        });
    }

    componentWillUnmount() {
        this.backHandler && this.backHandler.remove();
    }

    renderDots(numberOfDots) {
        const dots = [];
        const { pinCode } = this.state;
        const pinTyped = pinCode.length;

        const styleDot = {
            width: 6,
            height: 6,
            borderRadius: 3,
            borderWidth: 1,
            borderColor: '#246ffa20',
            marginHorizontal: 12,
        };
        const styleBigDot = {
            width: 12,
            height: 12,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: mColor,
            marginHorizontal: 12,
        };
        for (let i = 0; i < numberOfDots; i++) {
            const backgroundColor = { backgroundColor: mColor };
            const dotStyle = i < pinTyped ? styleBigDot : styleDot;
            const dot = <View style={[dotStyle, backgroundColor]} key={i} />;
            dots.push(dot);
        }
        return dots;
    }

    // eslint-disable-next-line react/sort-comp
    handleErrorCode(errorMsg) {
        const { dispatch } = this.props;
        Animated.spring(this.animatedValue, {
            toValue: this.isShake ? 0 : 1,
            duration: 250,
            tension: 80,
            friction: 4,
        }).start();
        this.isShake = !this.isShake;
        this.errorCounts += 1;
        if (this.errorCounts === 5) {
            AppToast.show(strings('pinCode.toast_please_login'));
            dispatch(createAction('userModel/logOut')());
        }
        this.setState({ pinCode: '', errorMsg });
    }

    handleCreateCode() {
        const { pinCode } = this.state;
        this.createPinCode = pinCode;
        this.setState({
            pinCode: '',
            pinState: 2,
        });
    }

    handleConfirmCode() {
        const { dispatch } = this.props;
        const { pinCode } = this.state;
        if (pinCode !== this.createPinCode) {
            this.handleErrorCode('pinCode_not_match');
            return false;
        }
        const hashedPinCode = hashPassword(pinCode);
        dispatch(createAction('userModel/updatePinCode')({ hashed_pinCode: hashedPinCode }));
        return true;
    }

    checkPinCode() {
        const { pinCode, pinState } = this.state;
        if (pinState === 0) {
            // unlock
            const hashedPinCode = hashPassword(pinCode);
            if (hashedPinCode === this.props.hashed_pinCode) {
                if (this.isModifyPinCode) {
                    this.setState({
                        pinCode: '',
                        pinState: 1,
                    });
                } else {
                    setTimeout(() => {
                        this.onUnlockSuccess && this.onUnlockSuccess();
                        this.targetScreen && this.props.navigation.navigate(this.targetScreen, this.targetScreenArgs);
                        this.targetScreen || this.props.navigation.goBack();
                    }, 100);
                }
            } else {
                this.handleErrorCode('pinCode_invalid');
            }
        } else if (pinState === 1) {
            this.handleCreateCode();
        } else if (pinState === 2) {
            this.handleConfirmCode() &&
                setTimeout(() => {
                    this.onUnlockSuccess && this.onUnlockSuccess();
                    console.log('this.targetScreen', this.targetScreen);
                    this.targetScreen && this.props.navigation.navigate(this.targetScreen, this.targetScreenArgs);
                    this.targetScreen || this.props.navigation.goBack();
                }, 100);
        }
    }

    onPressNumber = number => {
        this.state.pinCode.length <= MaxPinCodeLength &&
            this.setState(
                {
                    pinCode: this.state.pinCode + number,
                    errorMsg: null,
                },
                () => {
                    if (this.state.pinCode.length === MaxPinCodeLength) {
                        this.checkPinCode();
                    }
                },
            );
    };

    onPressDelete = () => {
        this.setState({
            pinCode: this.state.pinCode.slice(0, this.state.pinCode.length - 1),
            errorMsg: null,
        });
    };

    onPressTouchId = () => {
        const { touchIDEnabled = false } = this.props;
        if (touchIDEnabled === false || this.isModifyPinCode === true) {
            return;
        }
        showTouchID(() => {
            this.onUnlockSuccess && this.onUnlockSuccess();
            this.targetScreen && this.props.navigation.navigate(this.targetScreen, this.targetScreenArgs);
            this.targetScreen || this.props.navigation.goBack();
        });
    };

    renderItem = ({ item }) => {
        const { biometryType } = this.props;
        const disabled = item === 'blank' || (item === 'cancel' && this.cancel === false);
        const noBorder = true; // item==="blank"||item==='cancel' || item === 'delete';
        const itemBorder = noBorder
            ? {}
            : {
                  borderRadius: 75 / 2,
                  borderWidth: 1,
                  borderColor: mColor,
              };
        const biometricImage = biometryType === 'FaceID' ? require('../../assets/icon_FaceID.png') : require('../../assets/icon_TouchID.png');
        return (
            <TouchableOpacity
                disabled={disabled}
                style={[styles.keyboardViewItem, itemBorder, { backgroundColor: 'transparent' }]}
                onPress={() => {
                    if (item !== 'cancel' && item !== 'delete' && item !== 'biometry') {
                        this.onPressNumber(item);
                    } else if (item === 'delete') {
                        this.onPressDelete();
                    } else if (item === 'cancel') {
                        this.cancel && this.props.navigation.goBack(); // can cancel
                    } else if (item === 'biometry') {
                        this.onPressTouchId();
                    }
                }}
            >
                <View style={[styles.keyboardViewItem, itemBorder, { backgroundColor: 'transparent' }]}>
                    {item !== 'cancel' && item !== 'delete' && item !== 'biometry' && item !== 'blank' && <Text style={[styles.keyboardViewItemText, { color: mColor, fontSize: 36 }]}>{item}</Text>}
                    {/* { this.cancel&&item === 'cancel'&& (<Text style={[styles.keyboardViewItemText, {color  : '#000',}]}>{strings('cancel_button')}</Text>) } */}
                    {this.cancel && item === 'cancel' && <Image source={require('../../assets/arrow_back.png')} style={{ tintColor: mColor, width: 30, height: 30 }} />}
                    {item === 'delete' && <Image source={require('../../assets/icon_delete.png')} style={{ tintColor: mColor, width: 30, height: 30 }} />}
                    {item === 'biometry' && <Image source={biometricImage} style={{ tintColor: mColor, width: 30, height: 30 }} />}
                </View>
            </TouchableOpacity>
        );
    };

    renderContent(unlockDescription, warningPincodeFail) {
        const { touchIDEnabled } = this.props;
        const animationShake = this.animatedValue.interpolate({
            inputRange: [0, 0.3, 0.7, 1],
            outputRange: [0, -20, 20, 0],
            useNativeDriver: true,
        });
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ marginTop: 20, alignItems: 'center' }}>
                    <Text style={styles.desText}>{unlockDescription}</Text>
                    <Text style={styles.warningField}>{warningPincodeFail}</Text>
                    <Animated.View
                        style={[
                            styles.pinField,
                            {
                                transform: [
                                    {
                                        translateX: animationShake,
                                    },
                                ],
                            },
                        ]}
                    >
                        {this.renderDots(MaxPinCodeLength)}
                    </Animated.View>
                </View>
                <View style={{ height: 450, marginBottom: 20 }}>
                    <FlatList
                        style={{ marginTop: 20 }}
                        contentContainerStyle={{
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                        }}
                        scrollEnabled={false}
                        horizontal={false}
                        vertical
                        numColumns={3}
                        renderItem={this.renderItem}
                        data={touchIDEnabled && !this.isModifyPinCode ? KeyboardDataWithTouchID : KeyboardData}
                        keyExtractor={(val, index) => index.toString()}
                    />
                </View>
            </View>
        );
    }

    render() {
        const { pinState, errorMsg } = this.state;
        let unlockDescription;
        let warningPincodeFail;
        if (pinState === 0) {
            unlockDescription = strings('pinCode.pinCode_enter');
        } else if (pinState === 1) {
            unlockDescription = strings('pinCode.pinCode_create');
        } else {
            unlockDescription = strings('pinCode.pinCode_confirm');
        }
        if (errorMsg && errorMsg !== '') {
            warningPincodeFail = `${strings(`pinCode.${errorMsg}`)} ${strings('pinCode.label_remaining_attempts', { count: 5 - this.errorCounts })}`;
        }
        return (
            <ImageBackground
                style={{
                    flex: 1,
                    paddingTop: getStatusBarHeight(true),
                    alignItems: 'center',
                    justifyContent: 'center',
                    // backgroundColor: mainBgColor
                }}
                source={require('../../assets/bg_splash.png')}
            >
                {this.renderContent(unlockDescription, warningPincodeFail)}
            </ImageBackground>
        );
    }
}

const mapToState = ({ userModel, settingsModel }) => ({
    hashed_pinCode: userModel.hashed_pinCode,
    touchIDEnabled: settingsModel.touchIDEnabled,
    biometryType: settingsModel.biometryType,
});

export default connect(mapToState)(PinCodeScreen);

const styles = StyleSheet.create({
    desText: {
        fontSize: isSmallScreen ? 14 : 22,
        marginTop: 20,
        color: mColor,
    },
    pinField: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 15,
    },
    warningField: {
        color: '#ff3300',
        fontSize: 16,
        marginVertical: 20,
        height: 20,
    },
    keyboardViewItem: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 75,
        width: 75,
        marginHorizontal: 20,
        marginVertical: 5,
    },
    keyboardViewItemText: {
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        fontSize: 20,
    },
});
